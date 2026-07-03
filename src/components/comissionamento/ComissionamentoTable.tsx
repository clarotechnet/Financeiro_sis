import React, { useEffect, useMemo, useState } from 'react';
import { LancamentoPix, OpcaoSelect } from '@/types/comissionamento';
import { ChevronLeft, ChevronRight, Pencil, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ComissionamentoEditDialog } from './ComissionamentoEditDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OpcoesData {
  cnpj: OpcaoSelect[];
  unidade: OpcaoSelect[];
  centro_de_custo: OpcaoSelect[];
  categoria: OpcaoSelect[];
  secao_custeio: OpcaoSelect[];
  plano_contas: OpcaoSelect[];
  bancos: OpcaoSelect[];
}

interface Props {
  data: LancamentoPix[];
  onUpdate: (id: string, updates: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  opcoes: OpcoesData;
}

const PAGE_SIZE = 50;

const formatDate = (val: string | null) => {
  if (!val) return '-';
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return val;
};

const fmtBRL = (v: number | null) =>
  v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';

const PDF_MARGIN = 10;
const PDF_HEADER_BOTTOM = 30;

const loadLogoDataUrl = async () => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}LogoNovo.png`);
    if (!response.ok) return null;
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const addPdfHeader = (
  doc: jsPDF,
  logoDataUrl: string | null,
  generatedAt: string,
  rowCount: number
) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', PDF_MARGIN, 6, 16, 16);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(220, 53, 69);
  doc.text('TechNET', PDF_MARGIN + 20, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text('Financeiro', PDF_MARGIN + 20, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text('PAGAMENTOS', pageWidth / 2, 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(`Gerado em: ${generatedAt}`, pageWidth - PDF_MARGIN, 12, { align: 'right' });
  doc.text(`${rowCount} registro(s)`, pageWidth - PDF_MARGIN, 17, { align: 'right' });

  doc.setDrawColor(220, 53, 69);
  doc.setLineWidth(0.3);
  doc.line(PDF_MARGIN, 25, pageWidth - PDF_MARGIN, 25);
  doc.setTextColor(0);
};

const addTotalToPdfTop = (
  doc: jsPDF,
  totalValor: number
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const totalHeight = 14;
  const totalY = PDF_HEADER_BOTTOM;

  const boxX = PDF_MARGIN;
  const boxWidth = pageWidth - (PDF_MARGIN * 2);
  const labelWidth = Math.min(58, boxWidth * 0.42);

  doc.setFillColor(244, 246, 248);
  doc.setDrawColor(31, 58, 95);
  doc.setLineWidth(0.5);
  doc.rect(boxX, totalY, boxWidth, totalHeight, 'FD');
  doc.setFillColor(31, 58, 95);
  doc.rect(boxX, totalY, labelWidth, totalHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.text('TOTAL GERAL', boxX + 6, totalY + 8.8);
  doc.setFontSize(13);
  doc.setTextColor(31, 58, 95);
  doc.text(fmtBRL(totalValor), pageWidth - PDF_MARGIN - 6, totalY + 9.1, { align: 'right' });
  doc.setTextColor(0);
  doc.setLineWidth(0.1);

  return totalY + totalHeight + 5;
};

const renderBreakableText = (value: string) =>
  value.split(/([/-])/).map((part, index) => (
    part === '/' || part === '-'
      ? <React.Fragment key={`${part}-${index}`}>{part}<wbr /></React.Fragment>
      : part
  ));

type PdfColumnKey =
  | 'data_lancamento'
  | 'unidade'
  | 'favorecido'
  | 'chave_pix'
  | 'conta_analitica'
  | 'centro_de_custo'
  | 'descricao'
  | 'banco'
  | 'status_pag'
  | 'valor';

interface PdfColumn {
  key: PdfColumnKey;
  label: string;
  getValue: (row: LancamentoPix) => string;
}

const PDF_COLUMNS: PdfColumn[] = [
  { key: 'data_lancamento', label: 'Data', getValue: row => formatDate(row.data_lancamento) },
  { key: 'unidade', label: 'Cidade/Unidade', getValue: row => row.unidade || '-' },
  { key: 'favorecido', label: 'Favorecido', getValue: row => row.favorecido || '-' },
  { key: 'chave_pix', label: 'Chave PIX', getValue: row => row.chave_pix || '-' },
  { key: 'conta_analitica', label: 'Conta Analítica', getValue: row => row.conta_analitica || '-' },
  { key: 'centro_de_custo', label: 'Centro de Custo', getValue: row => row.centro_de_custo || '-' },
  { key: 'descricao', label: 'Observação', getValue: row => row.descricao || '-' },
  { key: 'banco', label: 'Banco', getValue: row => row.banco || '-' },
  { key: 'status_pag', label: 'Status', getValue: row => row.status_pag || '-' },
  { key: 'valor', label: 'Valor', getValue: row => fmtBRL(row.valor) },
];

const DEFAULT_PDF_COLUMNS = PDF_COLUMNS.map(column => column.key);

export const ComissionamentoTable: React.FC<Props> = ({ data, onUpdate, onDelete, opcoes }) => {
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<keyof LancamentoPix>('data_lancamento');
  const [sortAsc, setSortAsc] = useState(false);
  const [editRecord, setEditRecord] = useState<LancamentoPix | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingFilteredPdf, setExportingFilteredPdf] = useState(false);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [selectedPdfColumns, setSelectedPdfColumns] = useState<PdfColumnKey[]>(DEFAULT_PDF_COLUMNS);
  const wrappedCellClass = 'whitespace-normal break-words leading-snug';

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const va = (a as any)[sortField];
      const vb = (b as any)[sortField];
      if (va == null && vb == null) return 0;
      if (va == null) return sortAsc ? -1 : 1;
      if (vb == null) return sortAsc ? 1 : -1;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortAsc ? va - vb : vb - va;
      }
      return sortAsc
        ? String(va).localeCompare(String(vb), 'pt-BR')
        : String(vb).localeCompare(String(va), 'pt-BR');
    });
    return arr;
  }, [data, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(currentPage => Math.min(currentPage, totalPages - 1));
  }, [totalPages]);

  const handleSort = (field: keyof LancamentoPix) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const columns: { key: keyof LancamentoPix | 'actions'; label: string }[] = [
    { key: 'actions', label: '' },
    { key: 'data_lancamento', label: 'Data' },
    { key: 'unidade', label: 'Cidade/Unidade' },
    { key: 'favorecido', label: 'Favorecido' },
    { key: 'chave_pix', label: 'Chave PIX' },
    { key: 'conta_analitica', label: 'Conta Analítica' },
    { key: 'centro_de_custo', label: 'Centro de Custo' },
    { key: 'descricao', label: 'Observação' },
    { key: 'banco', label: 'Banco' },
    { key: 'status_pag', label: 'Status' },
    { key: 'valor', label: 'Valor' },
  ];

  const totalValor = useMemo(() => sorted.reduce((s, r) => s + (r.valor || 0), 0), [sorted]);

  const togglePdfColumn = (key: PdfColumnKey, checked: boolean) => {
    setSelectedPdfColumns(current => (
      checked
        ? Array.from(new Set([...current, key]))
        : current.filter(column => column !== key)
    ));
  };

  const exportFilteredPDF = async () => {
    if (exportingFilteredPdf || selectedPdfColumns.length === 0) return;

    setExportingFilteredPdf(true);
    try {
      const generatedAt = new Date().toLocaleString('pt-BR');
      const logoDataUrl = await loadLogoDataUrl();
      const selectedColumns = PDF_COLUMNS.filter(column => selectedPdfColumns.includes(column.key));
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const tableStartY = addTotalToPdfTop(doc, totalValor);
      const columnStyles = selectedColumns.reduce<Record<number, any>>((styles, column, index) => {
        if (column.key === 'valor') styles[index] = { halign: 'right', cellWidth: 22 };
        if (column.key === 'data_lancamento') styles[index] = { ...(styles[index] || {}), cellWidth: 17 };
        if (column.key === 'status_pag') styles[index] = { ...(styles[index] || {}), cellWidth: 16 };
        return styles;
      }, {});

      autoTable(doc, {
        startY: tableStartY,
        head: [selectedColumns.map(column => column.label)],
        body: sorted.map(row => selectedColumns.map(column => column.getValue(row))),
        margin: { top: PDF_HEADER_BOTTOM, right: PDF_MARGIN, bottom: 14, left: PDF_MARGIN },
        styles: {
          fontSize: selectedColumns.length > 7 ? 6.1 : 7,
          cellPadding: 1.4,
          overflow: 'linebreak',
          valign: 'top',
          lineColor: [235, 235, 235],
          lineWidth: 0.1,
        },
        headStyles: { fillColor: [31, 58, 95], textColor: 255 },
        alternateRowStyles: { fillColor: [247, 247, 247] },
        columnStyles,
        didDrawPage: () => {
          addPdfHeader(doc, logoDataUrl, generatedAt, sorted.length);
        },
      });

      doc.save(`dados-detalhados-filtro-${new Date().toISOString().slice(0, 10)}.pdf`);
      setColumnDialogOpen(false);
    } finally {
      setExportingFilteredPdf(false);
    }
  };

  const exportPDF = async () => {
    if (exportingPdf) return;

    setExportingPdf(true);
    try {
      const generatedAt = new Date().toLocaleString('pt-BR');
      const logoDataUrl = await loadLogoDataUrl();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const tableStartY = addTotalToPdfTop(doc, totalValor);

      autoTable(doc, {
        startY: tableStartY,
        head: [['Data', 'Cidade/Unidade', 'Favorecido', 'Chave PIX', 'Conta Analítica', 'Centro de Custo', 'Observação', 'Banco', 'Status', 'Valor']],
        body: sorted.map(r => [
          formatDate(r.data_lancamento),
          r.unidade || '-',
          r.favorecido || '-',
          r.chave_pix || '-',
          r.conta_analitica || '-',
          r.centro_de_custo || '-',
          r.descricao || '-',
          r.banco || '-',
          r.status_pag || '-',
          fmtBRL(r.valor),
        ]),
        margin: { top: PDF_HEADER_BOTTOM, right: PDF_MARGIN, bottom: 14, left: PDF_MARGIN },
        styles: {
          fontSize: 6.8,
          cellPadding: 1.5,
          overflow: 'linebreak',
          valign: 'top',
          lineColor: [235, 235, 235],
          lineWidth: 0.1,
        },
        headStyles: { fillColor: [31, 58, 95], textColor: 255 },
        alternateRowStyles: { fillColor: [247, 247, 247] },
        columnStyles: {
          0: { cellWidth: 17 },
          1: { cellWidth: 22 },
          2: { cellWidth: 39 },
          3: { cellWidth: 25 },
          4: { cellWidth: 38 },
          5: { cellWidth: 24 },
          6: { cellWidth: 44 },
          7: { cellWidth: 25 },
          8: { cellWidth: 15 },
          9: { cellWidth: 24, halign: 'right' },
        },
        didDrawPage: () => {
          addPdfHeader(doc, logoDataUrl, generatedAt, sorted.length);
        },
      });

      doc.save(`dados-detalhados-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-end gap-2 mb-4">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setColumnDialogOpen(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar por Filtro
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={exportingPdf}>
            <FileText className="w-4 h-4 mr-2" />
            {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground">
          Valor Total: <span className="text-primary">{fmtBRL(totalValor)}</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-[600px] w-full overflow-auto [scrollbar-gutter:stable]">
          <table className="data-table min-w-[1160px] w-full table-fixed text-[11px] [&_th]:px-2.5 [&_th]:py-3 [&_td]:px-2.5 [&_td]:py-3 [&_td]:align-top">
            <colgroup>
              <col style={{ width: '30px' }} />
              <col style={{ width: '88px' }} />
              <col style={{ width: '92px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '72px' }} />
              <col style={{ width: '210px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '105px' }} />
            </colgroup>
            <thead>
              <tr>
                {columns.map(col => {
                  const isSortable = col.key !== 'actions';
                  const sortIndicator = sortField === col.key ? (sortAsc ? '▲' : '▼') : '';

                  return (
                    <th
                      key={col.key as string}
                      onClick={isSortable ? () => handleSort(col.key as keyof LancamentoPix) : undefined}
                      className={`text-left leading-tight whitespace-normal break-words ${isSortable ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                    >
                      {renderBreakableText(col.label)} {sortIndicator}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageData.map((row, i) => (
                <tr key={row.id || i}>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setEditRecord(row)}
                      title="Editar"
                    >
                      <Pencil className="w-3 h-3 text-muted-foreground hover:text-primary" />
                    </Button>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(row.data_lancamento)}</td>
                  <td className={wrappedCellClass}>{row.unidade || '-'}</td>
                  <td className={`font-medium ${wrappedCellClass}`}>{row.favorecido || '-'}</td>
                  <td className="text-xs text-muted-foreground truncate" title={row.chave_pix || ''}>{row.chave_pix || '-'}</td>
                  <td className={wrappedCellClass}>{row.conta_analitica || '-'}</td>
                  <td className={wrappedCellClass}>{row.centro_de_custo || '-'}</td>
                  <td className={wrappedCellClass}>{row.descricao || '-'}</td>
                  <td className={wrappedCellClass}>{row.banco || '-'}</td>
                  <td>
                    {row.status_pag ? (
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${(row.status_pag || '').toUpperCase() === 'PAGO'
                        ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                        : 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                        }`}>{row.status_pag}</span>
                    ) : '-'}
                  </td>
                  <td className="font-semibold whitespace-nowrap text-right">{fmtBRL(row.valor)}</td>
                </tr>
              ))}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-center py-6 text-muted-foreground">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages} ({sorted.length} registros)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ComissionamentoEditDialog
        open={!!editRecord}
        onClose={() => setEditRecord(null)}
        onSave={onUpdate}
        onDelete={onDelete}
        record={editRecord}
        opcoes={opcoes}
      />

      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Exportar PDF por Filtro</DialogTitle>
            <DialogDescription>
              Selecione as colunas que devem aparecer no PDF em modo retrato.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            {PDF_COLUMNS.map(column => (
              <label
                key={column.key}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium"
              >
                <Checkbox
                  checked={selectedPdfColumns.includes(column.key)}
                  onCheckedChange={checked => togglePdfColumn(column.key, checked === true)}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>

          <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Total em Valor: <strong className="text-foreground">{fmtBRL(totalValor)}</strong>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedPdfColumns([])}
              disabled={exportingFilteredPdf}
            >
              Limpar
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedPdfColumns(DEFAULT_PDF_COLUMNS)}
              disabled={exportingFilteredPdf}
            >
              Todas
            </Button>
            <Button
              onClick={exportFilteredPDF}
              disabled={exportingFilteredPdf || selectedPdfColumns.length === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              {exportingFilteredPdf ? 'Gerando PDF...' : 'Gerar PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
