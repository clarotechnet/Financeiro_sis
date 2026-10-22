import * as XLSX from 'xlsx';
import type { BeneficioImportRow, BeneficioTipo } from '@/types/beneficios';

const normKey = (key: string) =>
  key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[Â°Âº]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeCpf = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length < 11 ? digits.padStart(11, '0') : digits;
};

const parseNum = (value: unknown): number => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return value;
  const normalized = String(value).replace(/[R$\s.]/g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseBenefitRows = async (file: File, tipo: BeneficioTipo): Promise<BeneficioImportRow[]> => {
  if (tipo === 'flash') {
    if (/\.pdf$/i.test(file.name)) {
      const { parseFlashPdf } = await import('@/lib/flashPdf');
      return parseFlashPdf(file);
    }
    if (!/\.xlsx$/i.test(file.name)) {
      throw new Error('O arquivo da Flash deve estar no formato PDF ou XLSX.');
    }
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  const headers = Object.keys(raw[0] || {});
  const flashValueColumn = headers.find(key => ['TOTAL', 'VALOR TOTAL'].includes(normKey(key)))
    || headers.find(key => normKey(key).includes('VALOR') || normKey(key) === 'FLASH');

  if (tipo === 'flash' && raw.length > 0 && (!headers.some(key => normKey(key).includes('CPF')) || !flashValueColumn)) {
    throw new Error('A planilha Flash deve conter as colunas CPF e Valor (ou Total).');
  }

  return raw.flatMap(row => {
    const entries = Object.entries(row);
    let cpfValue: unknown = null;
    let placaValue: unknown = null;
    let valorValue: unknown = tipo === 'flash' && flashValueColumn ? row[flashValueColumn] : null;

    for (const [key, value] of entries) {
      const normalizedKey = normKey(key);
      if (cpfValue == null && normalizedKey.includes('CPF')) cpfValue = value;
      if (tipo === 'combustivel' && placaValue == null && normalizedKey.includes('PLACA')) placaValue = value;
      if (
        tipo !== 'flash' && valorValue == null &&
        (
          normalizedKey.includes('VALOR') ||
          normalizedKey.includes('COMBUSTIVEL') ||
          normalizedKey.includes('AGREGAMENTO') ||
          normalizedKey.includes('FLASH')
        )
      ) {
        valorValue = value;
      }
    }

    if (tipo !== 'flash' && cpfValue == null) cpfValue = entries[0]?.[1] ?? null;
    if (tipo === 'combustivel' && placaValue == null) placaValue = entries[1]?.[1] ?? null;
    if (tipo !== 'flash' && valorValue == null) valorValue = entries[tipo === 'combustivel' ? 2 : 1]?.[1] ?? null;

    const cpf = normalizeCpf(cpfValue);
    const placa = String(placaValue ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    const valor = parseNum(valorValue);
    if (!cpf && !placa && valor <= 0) return [];

    return tipo === 'combustivel' ? [{ cpf, placa, valor }] : [{ cpf, valor }];
  });
};
