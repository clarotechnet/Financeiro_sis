import { externalSupabase } from '@/integrations/supabase/externalClient';

export const PAYMENT_RECEIPTS_BUCKET = 'comprovantes-pagamentos';
export const PAYMENT_RECEIPT_MAX_SIZE = 10 * 1024 * 1024;

const createFileId = () => (
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
);

export const validatePaymentReceipt = async (file: File) => {
  if (file.size > PAYMENT_RECEIPT_MAX_SIZE) {
    throw new Error('O comprovante deve ter no máximo 10 MB.');
  }

  const extensionIsPdf = file.name.toLowerCase().endsWith('.pdf');
  const mimeIsPdf = file.type === 'application/pdf';
  const signature = new TextDecoder('ascii').decode(
    await file.slice(0, 5).arrayBuffer(),
  );

  if ((!extensionIsPdf && !mimeIsPdf) || signature !== '%PDF-') {
    throw new Error('Selecione um arquivo PDF válido.');
  }
};

export const uploadPaymentReceipt = async (file: File) => {
  await validatePaymentReceipt(file);

  const { data: userData, error: userError } = await externalSupabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Sua sessão expirou. Entre novamente para anexar o comprovante.');
  }

  const path = `${userData.user.id}/${createFileId()}.pdf`;
  const { error } = await externalSupabase.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: 'application/pdf',
      upsert: false,
    });

  if (error) throw new Error(`Não foi possível enviar o comprovante: ${error.message}`);

  return {
    path,
    name: file.name,
  };
};

export const removePaymentReceipt = async (path: string) => {
  if (!path) return;
  await externalSupabase.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .remove([path]);
};

export const createPaymentReceiptUrl = async (path: string) => {
  const { data, error } = await externalSupabase.storage
    .from(PAYMENT_RECEIPTS_BUCKET)
    .createSignedUrl(path, 60);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Não foi possível abrir o comprovante.');
  }

  return data.signedUrl;
};
