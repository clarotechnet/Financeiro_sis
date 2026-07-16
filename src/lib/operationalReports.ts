import * as XLSX from 'xlsx';

export type OperationalReportSource =
  | 'folha_pagamento'
  | 'beneficios_combustivel'
  | 'beneficios_agregamento'
  | 'beneficios_flash';

export interface OperationalReportInput {
  date: string | null | undefined;
  unitCode: string | null | undefined;
  unitName: string | null | undefined;
  costCenterCode: string | null | undefined;
  costCenterName: string | null | undefined;
  value: number | null | undefined;
}

export interface OperationalReportRow {
  reportId: string;
  rowNumber: number;
  source: OperationalReportSource;
  sourceLabel: string;
  date: string;
  unitCode: string;
  unitName: string;
  costCenterCode: string;
  costCenterName: string;
  description: string;
  quantity: number;
  value: number;
}

const SOURCE_LABELS: Record<OperationalReportSource, string> = {
  folha_pagamento: 'Folha de Pagamento',
  beneficios_combustivel: 'Beneficio - Combustivel',
  beneficios_agregamento: 'Beneficio - Agregamento',
  beneficios_flash: 'Beneficio - Flash',
};

const createReportId = () => (
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `relatorio-${Date.now()}-${Math.random().toString(16).slice(2)}`
);

const formatDatePtBr = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

export const buildOperationalReport = (
  source: OperationalReportSource,
  inputs: OperationalReportInput[],
) => {
  const reportId = createReportId();
  const groups = new Map<string, Omit<OperationalReportRow, 'rowNumber' | 'reportId'> & { quantity: number }>();
  let ignored = 0;

  inputs.forEach(input => {
    const date = String(input.date || '').slice(0, 10);
    const unitCode = String(input.unitCode || '').trim();
    const unitName = String(input.unitName || '').trim();
    const costCenterCode = String(input.costCenterCode || '').trim();
    const costCenterName = String(input.costCenterName || '').trim();
    const value = Number(input.value) || 0;

    if (!date || !unitCode || !costCenterCode || value <= 0) {
      ignored++;
      return;
    }

    const key = [date, unitCode, costCenterCode].join('|');
    const current = groups.get(key);

    if (current) {
      current.value += value;
      current.quantity += 1;
      return;
    }

    groups.set(key, {
      source,
      sourceLabel: SOURCE_LABELS[source],
      date,
      unitCode,
      unitName: unitName || unitCode,
      costCenterCode,
      costCenterName: costCenterName || costCenterCode,
      description: `${SOURCE_LABELS[source]} - ${costCenterName || costCenterCode} - ${unitName || unitCode}`,
      quantity: 1,
      value,
    });
  });

  const rows: OperationalReportRow[] = Array.from(groups.values())
    .sort((a, b) => (
      a.date.localeCompare(b.date)
      || a.unitCode.localeCompare(b.unitCode, 'pt-BR', { numeric: true })
      || a.costCenterCode.localeCompare(b.costCenterCode, 'pt-BR', { numeric: true })
    ))
    .map((row, index) => ({
      reportId,
      rowNumber: index + 1,
      ...row,
      value: Number(row.value.toFixed(2)),
    }));

  return { reportId, rows, ignored };
};

export const downloadOperationalReport = (
  source: OperationalReportSource,
  inputs: OperationalReportInput[],
) => {
  const result = buildOperationalReport(source, inputs);
  if (result.rows.length === 0) {
    throw new Error('Nenhuma linha com data, unidade, centro de custo e valor foi encontrada para gerar o relatorio.');
  }

  const worksheet = XLSX.utils.json_to_sheet(result.rows.map(row => ({
    'RELATORIO ID': row.reportId,
    'LINHA': row.rowNumber,
    'ORIGEM': row.source,
    'ORIGEM DESCRICAO': row.sourceLabel,
    'DATA': formatDatePtBr(row.date),
    'UNIDADE CODIGO': row.unitCode,
    'UNIDADE': row.unitName,
    'CENTRO DE CUSTO CODIGO': row.costCenterCode,
    'CENTRO DE CUSTO': row.costCenterName,
    'DESCRICAO': row.description,
    'QUANTIDADE': row.quantity,
    'VALOR': row.value,
  })));

  worksheet['!cols'] = [
    { wch: 38 }, { wch: 8 }, { wch: 26 }, { wch: 30 }, { wch: 14 },
    { wch: 18 }, { wch: 32 }, { wch: 26 }, { wch: 44 }, { wch: 68 },
    { wch: 12 }, { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatorio');
  XLSX.writeFile(
    workbook,
    `relatorio_${source}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );

  return result;
};

