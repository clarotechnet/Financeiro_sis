import React, { useRef, useState } from 'react';
import { Eye, FileText, Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createPaymentReceiptUrl,
  PAYMENT_RECEIPT_MAX_SIZE,
  validatePaymentReceipt,
} from '@/lib/paymentReceipt';

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingPath?: string | null;
  existingName?: string | null;
  disabled?: boolean;
}

const formatFileSize = (size: number) => (
  size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
    : `${Math.ceil(size / 1024)} KB`
);

export const PaymentReceiptField: React.FC<Props> = ({
  file,
  onFileChange,
  existingPath,
  existingName,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setError('');

    if (!selectedFile) {
      onFileChange(null);
      return;
    }

    try {
      await validatePaymentReceipt(selectedFile);
      onFileChange(selectedFile);
    } catch (validationError) {
      onFileChange(null);
      setError(validationError instanceof Error ? validationError.message : 'PDF inválido.');
      event.target.value = '';
    }
  };

  const clearSelection = () => {
    onFileChange(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const openExisting = async () => {
    if (!existingPath) return;
    setOpening(true);
    setError('');
    try {
      const signedUrl = await createPaymentReceiptUrl(existingPath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Não foi possível abrir o comprovante.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label htmlFor="comprovante-pagamento" className="flex items-center gap-2 text-sm font-medium">
            <Paperclip className="h-4 w-4 text-primary" />
            Comprovante de pagamento
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional. Somente PDF, com até {PAYMENT_RECEIPT_MAX_SIZE / (1024 * 1024)} MB.
          </p>
        </div>

        {existingPath && !file && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openExisting}
            disabled={disabled || opening}
          >
            {opening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Visualizar atual
          </Button>
        )}
      </div>

      <Input
        ref={inputRef}
        id="comprovante-pagamento"
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            onClick={clearSelection}
            disabled={disabled}
            title="Remover arquivo selecionado"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!file && existingPath && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" />
          Comprovante atual: {existingName || 'comprovante.pdf'}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};
