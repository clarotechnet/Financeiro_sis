import * as XLSX from 'xlsx';
import { SSF } from 'xlsx/xlsx.mjs';
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

export const parseCombustivelDate = (value: unknown, date1904 = false): string => {
  let year: number;
  let month: number;
  let day: number;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = SSF.parse_date_code(value, { date1904 });
    if (!parsed) return '';
    year = parsed.y;
    month = parsed.m;
    day = parsed.d;
  } else if (value instanceof Date && Number.isFinite(value.getTime())) {
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
    day = value.getUTCDate();
  } else {
    const text = String(value ?? '').trim();
    const brazilian = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!brazilian && !iso) return '';
    year = Number(brazilian ? brazilian[3] : iso![1]);
    month = Number(brazilian ? brazilian[2] : iso![2]);
    day = Number(brazilian ? brazilian[1] : iso![3]);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const getCombustivelImportKey = (row: BeneficioImportRow): string => {
  const placa = String(row.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `${row.data_beneficio}:${normalizeCpf(row.cpf)}:${placa}:${Math.round(row.valor * 100)}`;
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
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: tipo !== 'combustivel' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  const headers = Object.keys(raw[0] || {});
  const flashValueColumn = headers.find(key => ['TOTAL', 'VALOR TOTAL'].includes(normKey(key)))
    || headers.find(key => normKey(key).includes('VALOR') || normKey(key) === 'FLASH');

  if (tipo === 'flash' && raw.length > 0 && (!headers.some(key => normKey(key).includes('CPF')) || !flashValueColumn)) {
    throw new Error('A planilha Flash deve conter as colunas CPF e Valor (ou Total).');
  }

  const fuelDateColumn = headers.find(key => normKey(key) === 'DATA');
  if (tipo === 'combustivel' && raw.length > 0 && !fuelDateColumn) {
    throw new Error('A planilha de Combustível deve conter a coluna Data de cada abastecimento.');
  }

  return raw.flatMap((row, index) => {
    const entries = Object.entries(row);
    let cpfValue: unknown = null;
    let placaValue: unknown = null;
    let valorValue: unknown = tipo === 'flash' && flashValueColumn ? row[flashValueColumn] : null;

    for (const [key, value] of entries) {
      const normalizedKey = normKey(key);
      if (cpfValue == null && normalizedKey.includes('CPF')) cpfValue = value;
      if (tipo === 'combustivel' && placaValue == null && (normalizedKey.includes('PLACA') || normalizedKey.includes('VEICULO'))) placaValue = value;
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

    if (tipo === 'combustivel') {
      const data_beneficio = parseCombustivelDate(row[fuelDateColumn!], !!workbook.Workbook?.WBProps?.date1904);
      if (!data_beneficio) {
        const line = typeof row.__rowNum__ === 'number' ? row.__rowNum__ + 1 : index + 2;
        throw new Error(`Linha ${line}: informe uma Data válida para o abastecimento (dd/mm/aaaa).`);
      }
      return [{ cpf, placa, valor, data_beneficio }];
    }
    return [{ cpf, valor }];
  });
};
