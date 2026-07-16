import React, { useEffect, useMemo, useState } from 'react';
import { LancamentoPix, OpcaoSelect } from '@/types/comissionamento';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, ListChecks, Pencil } from 'lucide-react';
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
  allRecords?: LancamentoPix[];
  onUpdate: (id: string, updates: Record<string, any>) => Promise<void>;
  onBulkUpdateStatus?: (ids: string[], status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  opcoes: OpcoesData;
  canManage?: boolean;
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

const compareLaunchOrder = (a: LancamentoPix, b: LancamentoPix) => {
  const createdA = a.created_at || '';
  const createdB = b.created_at || '';
  const createdCompare = createdA.localeCompare(createdB);
  if (createdCompare !== 0) return createdCompare;
  return (a.id || '').localeCompare(b.id || '');
};

const compareSortValues = (a: LancamentoPix, b: LancamentoPix, field: keyof LancamentoPix, ascending: boolean) => {
  const va = (a as any)[field];
  const vb = (b as any)[field];

  let primaryCompare = 0;
  if (va == null && vb == null) primaryCompare = 0;
  else if (va == null) primaryCompare = -1;
  else if (vb == null) primaryCompare = 1;
  else if (typeof va === 'number' && typeof vb === 'number') primaryCompare = va - vb;
  else primaryCompare = String(va).localeCompare(String(vb), 'pt-BR');

  if (primaryCompare !== 0) return ascending ? primaryCompare : -primaryCompare;
  return compareLaunchOrder(a, b);
};

const compareRateioItemOrder = (a: LancamentoPix, b: LancamentoPix) => {
  const orderA = a.rateio_item_ordem ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.rateio_item_ordem ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;
  return compareLaunchOrder(a, b);
};

const buildRateioGroupedRows = (rows: LancamentoPix[]): LancamentoPix[] => {
  const byLote = new Map<string, LancamentoPix[]>();
  rows.forEach(row => {
    if (!row.rateio_lote_id) return;
    const items = byLote.get(row.rateio_lote_id) || [];
    items.push(row);
    byLote.set(row.rateio_lote_id, items);
  });

  const usedLotes = new Set<string>();
  const groupedRows: LancamentoPix[] = [];

  rows.forEach(row => {
    const loteId = row.rateio_lote_id;
    if (!loteId) {
      groupedRows.push(row);
      return;
    }

    if (usedLotes.has(loteId)) return;
    usedLotes.add(loteId);

    const items = [...(byLote.get(loteId) || [row])].sort(compareRateioItemOrder);
    const first = items[0] || row;
    const total = items.reduce((sum, item) => sum + (item.valor || 0), 0);

    groupedRows.push({
      ...first,
      unidade: `${items.length} rateio(s)`,
      centro_de_custo: 'Rateio geral',
      conta_analitica: 'Múltiplos Rateios',
      valor: total,
    });
  });

  return groupedRows;
};

type RateioTableRow =
  | { kind: 'normal'; key: string; record: LancamentoPix }
  | { kind: 'rateio-summary'; key: string; loteId: string; record: LancamentoPix; items: LancamentoPix[]; total: number }
  | { kind: 'rateio-item'; key: string; record: LancamentoPix; index: number };

const isPaidStatus = (status: string | null | undefined) =>
  (status || '').toUpperCase() === 'PAGO';

export const ComissionamentoTable: React.FC<Props> = ({ data, allRecords = data, onUpdate, onBulkUpdateStatus, onDelete, opcoes, canManage = true }) => {
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<keyof LancamentoPix>('data_lancamento');
  const [sortAsc, setSortAsc] = useState(false);
  const [editRecord, setEditRecord] = useState<LancamentoPix | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [previewingPdf, setPreviewingPdf] = useState(false);
  const [exportingFilteredPdf, setExportingFilteredPdf] = useState(false);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [selectedPdfColumns, setSelectedPdfColumns] = useState<PdfColumnKey[]>(DEFAULT_PDF_COLUMNS);
  const [groupRateiosInFilteredPdf, setGroupRateiosInFilteredPdf] = useState(false);
  const [expandedRateioLotes, setExpandedRateioLotes] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const wrappedCellClass = 'whitespace-normal break-words leading-snug';

  const editRateioRecords = useMemo(() => {
    if (!editRecord?.rateio_lote_id) return [];
    return allRecords
      .filter(row => row.rateio_lote_id === editRecord.rateio_lote_id)
      .sort(compareRateioItemOrder);
  }, [allRecords, editRecord]);

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => compareSortValues(a, b, sortField, sortAsc));
    return arr;
  }, [data, sortField, sortAsc]);

  const tableRows = useMemo<RateioTableRow[]>(() => {
    const byLote = new Map<string, LancamentoPix[]>();
    sorted.forEach(row => {
      if (!row.rateio_lote_id) return;
      const items = byLote.get(row.rateio_lote_id) || [];
      items.push(row);
      byLote.set(row.rateio_lote_id, items);
    });

    const usedLotes = new Set<string>();
    const rows: RateioTableRow[] = [];

    sorted.forEach((row, index) => {
      const loteId = row.rateio_lote_id;
      if (!loteId) {
        rows.push({ kind: 'normal', key: row.id || `normal-${index}`, record: row });
        return;
      }

      if (usedLotes.has(loteId)) return;
      usedLotes.add(loteId);

      const items = [...(byLote.get(loteId) || [row])].sort(compareRateioItemOrder);
      rows.push({
        kind: 'rateio-summary',
        key: `rateio-summary-${loteId}`,
        loteId,
        record: items[0] || row,
        items,
        total: items.reduce((sum, item) => sum + (item.valor || 0), 0),
      });

      if (expandedRateioLotes.has(loteId)) {
        items.forEach((item, itemIndex) => {
          rows.push({
            kind: 'rateio-item',
            key: item.id || `rateio-item-${loteId}-${itemIndex}`,
            record: item,
            index: itemIndex,
          });
        });
      }
    });

    return rows;
  }, [sorted, expandedRateioLotes]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageData = tableRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const getSelectableIds = (tableRow: RateioTableRow) => {
    if (tableRow.kind === 'rateio-summary') {
      return tableRow.items
        .filter(item => item.id && !isPaidStatus(item.status_pag))
        .map(item => item.id as string);
    }

    const id = tableRow.record.id;
    return id && !isPaidStatus(tableRow.record.status_pag) ? [id] : [];
  };

  const pageSelectableIds = useMemo(
    () => pageData.flatMap(getSelectableIds),
    [pageData]
  );
  const allPageSelected = pageSelectableIds.length > 0
    && pageSelectableIds.every(id => selectedIds.has(id));
  const somePageSelected = pageSelectableIds.some(id => selectedIds.has(id));

  useEffect(() => {
    setPage(currentPage => Math.min(currentPage, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    const validLotes = new Set(data.map(row => row.rateio_lote_id).filter(Boolean) as string[]);
    setExpandedRateioLotes(current => {
      const next = new Set([...current].filter(loteId => validLotes.has(loteId)));
      return next.size === current.size ? current : next;
    });
  }, [data]);

  useEffect(() => {
    const validIds = new Set(
      data
        .filter(row => row.id && !isPaidStatus(row.status_pag))
        .map(row => row.id as string)
    );

    setSelectedIds(current => {
      const next = new Set([...current].filter(id => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [data]);

  const handleSort = (field: keyof LancamentoPix) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleRateioLote = (loteId: string) => {
    setExpandedRateioLotes(current => {
      const next = new Set(current);
      if (next.has(loteId)) next.delete(loteId);
      else next.add(loteId);
      return next;
    });
  };

  const toggleSelectionMode = () => {
    if (selectionMode) setSelectedIds(new Set());
    setSelectionMode(current => !current);
  };

  const toggleSelectedIds = (ids: string[], checked: boolean) => {
    setSelectedIds(current => {
      const next = new Set(current);
      ids.forEach(id => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const markSelectedAsPaid = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkUpdating) return;

    setBulkUpdating(true);
    try {
      if (onBulkUpdateStatus) {
        await onBulkUpdateStatus(ids, 'PAGO');
      } else {
        await Promise.all(ids.map(id => onUpdate(id, { status_pag: 'PAGO' })));
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
    } finally {
      setBulkUpdating(false);
    }
  };

  const columns: { key: keyof LancamentoPix | 'actions' | 'selection'; label: string }[] = [
    ...(canManage && selectionMode ? [{ key: 'selection' as const, label: '' }] : []),
    ...(canManage ? [{ key: 'actions' as const, label: '' }] : []),
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
      const pdfRows = groupRateiosInFilteredPdf ? buildRateioGroupedRows(sorted) : sorted;
      const pdfTotalValor = pdfRows.reduce((sum, row) => sum + (row.valor || 0), 0);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const tableStartY = addTotalToPdfTop(doc, pdfTotalValor);
      const columnStyles = selectedColumns.reduce<Record<number, any>>((styles, column, index) => {
        if (column.key === 'valor') styles[index] = { halign: 'right', cellWidth: 22 };
        if (column.key === 'data_lancamento') styles[index] = { ...(styles[index] || {}), cellWidth: 17 };
        if (column.key === 'status_pag') styles[index] = { ...(styles[index] || {}), cellWidth: 16 };
        return styles;
      }, {});

      autoTable(doc, {
        startY: tableStartY,
        head: [selectedColumns.map(column => column.label)],
        body: pdfRows.map(row => selectedColumns.map(column => column.getValue(row))),
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
          addPdfHeader(doc, logoDataUrl, generatedAt, pdfRows.length);
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
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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

  const previewPDF = async () => {
    if (previewingPdf) return;

    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write('<p style="font-family: sans-serif">Gerando PDF...</p>');
    }

    setPreviewingPdf(true);
    try {
      const generatedAt = new Date().toLocaleString('pt-BR');
      const logoDataUrl = await loadLogoDataUrl();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const tableStartY = addTotalToPdfTop(doc, totalValor);

      autoTable(doc, {
        startY: tableStartY,
        head: [['Data', 'Cidade/Unidade', 'Favorecido', 'Conta Analitica', 'Centro de Custo', 'Observacao', 'Banco', 'Status', 'Valor']],
        body: sorted.map(r => [
          formatDate(r.data_lancamento),
          r.unidade || '-',
          r.favorecido || '-',
          r.conta_analitica || '-',
          r.centro_de_custo || '-',
          r.descricao || '-',
          r.banco || '-',
          r.status_pag || '-',
          fmtBRL(r.valor),
        ]),
        margin: { top: PDF_HEADER_BOTTOM, right: PDF_MARGIN, bottom: 14, left: PDF_MARGIN },
        styles: {
          fontSize: 5.8,
          cellPadding: 1.2,
          overflow: 'linebreak',
          valign: 'top',
          lineColor: [235, 235, 235],
          lineWidth: 0.1,
        },
        headStyles: { fillColor: [31, 58, 95], textColor: 255 },
        alternateRowStyles: { fillColor: [247, 247, 247] },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 18 },
          2: { cellWidth: 28 },
          3: { cellWidth: 30 },
          4: { cellWidth: 22 },
          5: { cellWidth: 31 },
          6: { cellWidth: 16 },
          7: { cellWidth: 12 },
          8: { cellWidth: 18, halign: 'right' },
        },
        didDrawPage: () => {
          addPdfHeader(doc, logoDataUrl, generatedAt, sorted.length);
        },
      });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      if (previewWindow) {
        previewWindow.location.href = pdfUrl;
      } else {
        window.open(pdfUrl, '_blank');
      }

      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (error) {
      previewWindow?.close();
      throw error;
    } finally {
      setPreviewingPdf(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-end gap-2 mb-4">
        <div className="flex flex-wrap justify-end gap-2">
          {canManage && (
            <Button
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={toggleSelectionMode}
              disabled={bulkUpdating}
            >
              <ListChecks className="w-4 h-4 mr-2" />
              {selectionMode ? 'Cancelar seleção' : 'Selecionar lançamentos'}
            </Button>
          )}
          {canManage && selectionMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={markSelectedAsPaid}
              disabled={selectedIds.size === 0 || bulkUpdating}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {bulkUpdating ? 'Atualizando...' : `Marcar como PAGO (${selectedIds.size})`}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setColumnDialogOpen(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar por Filtro
          </Button>
          <Button variant="outline" size="sm" onClick={previewPDF} disabled={previewingPdf}>
            <Eye className="w-4 h-4 mr-2" />
            {previewingPdf ? 'Gerando PDF...' : 'Visualizar PDF'}
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
              {canManage && selectionMode && <col style={{ width: '38px' }} />}
              {canManage && <col style={{ width: '30px' }} />}
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
                  if (col.key === 'selection') {
                    return (
                      <th key="selection" className="text-left">
                        <Checkbox
                          checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                          disabled={pageSelectableIds.length === 0 || bulkUpdating}
                          onCheckedChange={checked => toggleSelectedIds(pageSelectableIds, checked === true)}
                          aria-label="Selecionar lançamentos desta página"
                        />
                      </th>
                    );
                  }

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
              {pageData.map((tableRow, i) => {
                const row = tableRow.record;

                if (tableRow.kind === 'rateio-summary') {
                  const expanded = expandedRateioLotes.has(tableRow.loteId);
                  const unidadeLabel = `${tableRow.items.length} rateio(s)`;
                  const selectableIds = getSelectableIds(tableRow);
                  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
                  const someSelected = selectableIds.some(id => selectedIds.has(id));

                  return (
                    <tr
                      key={tableRow.key}
                      className="cursor-pointer border-y border-primary/20 bg-primary/5 hover:bg-primary/10"
                      onClick={() => toggleRateioLote(tableRow.loteId)}
                      title={expanded ? 'Recolher rateios' : 'Ver rateios deste lançamento'}
                    >
                      {canManage && selectionMode && (
                        <td onClick={event => event.stopPropagation()}>
                          <Checkbox
                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                            disabled={selectableIds.length === 0 || bulkUpdating}
                            onCheckedChange={checked => toggleSelectedIds(selectableIds, checked === true)}
                            aria-label="Selecionar rateios pendentes"
                          />
                        </td>
                      )}
                      {canManage && (
                        <td>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={event => {
                                event.stopPropagation();
                                setEditRecord(tableRow.record);
                              }}
                              title="Editar rateios"
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground hover:text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={event => {
                                event.stopPropagation();
                                toggleRateioLote(tableRow.loteId);
                              }}
                              title={expanded ? 'Recolher rateios' : 'Ver rateios'}
                            >
                              <ChevronDown className={`w-3 h-3 text-primary transition-transform ${expanded ? '' : '-rotate-90'}`} />
                            </Button>
                          </div>
                        </td>
                      )}
                      <td className="whitespace-nowrap font-semibold">{formatDate(row.data_lancamento)}</td>
                      <td className={wrappedCellClass}>{unidadeLabel}</td>
                      <td className={`font-semibold ${wrappedCellClass}`}>{row.favorecido || '-'}</td>
                      <td className="text-xs text-muted-foreground truncate" title={row.chave_pix || ''}>{row.chave_pix || '-'}</td>
                      <td className="font-semibold text-primary">Múltiplos Rateios</td>
                      <td className={wrappedCellClass}>Clique para ver detalhes</td>
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
                      <td className="font-black whitespace-nowrap text-right">{fmtBRL(tableRow.total)}</td>
                    </tr>
                  );
                }

                const isRateioItem = tableRow.kind === 'rateio-item';
                const selectableIds = getSelectableIds(tableRow);
                const isSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

                return (
                  <tr key={tableRow.key} className={isRateioItem ? 'bg-muted/20' : undefined}>
                    {canManage && selectionMode && (
                      <td>
                        <Checkbox
                          checked={isSelected}
                          disabled={selectableIds.length === 0 || bulkUpdating}
                          onCheckedChange={checked => toggleSelectedIds(selectableIds, checked === true)}
                          aria-label="Selecionar lançamento pendente"
                        />
                      </td>
                    )}
                    {canManage && (
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
                    )}
                    <td className="whitespace-nowrap">{formatDate(row.data_lancamento)}</td>
                    <td className={wrappedCellClass}>{isRateioItem ? `Item ${tableRow.index + 1}: ${row.unidade || '-'}` : row.unidade || '-'}</td>
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
                );
              })}
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

      {canManage && (
        <ComissionamentoEditDialog
          open={!!editRecord}
          onClose={() => setEditRecord(null)}
          onSave={onUpdate}
          onDelete={onDelete}
          record={editRecord}
          rateioRecords={editRateioRecords}
          opcoes={opcoes}
        />
      )}

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

          <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-sm">
            <Checkbox
              checked={groupRateiosInFilteredPdf}
              onCheckedChange={checked => setGroupRateiosInFilteredPdf(checked === true)}
            />
            <span>
              <span className="block font-semibold text-foreground">Gerar PDF com rateio geral</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Quando marcado, cada Múltiplos Rateios aparece como uma única linha com o valor total do boleto.
              </span>
            </span>
          </label>


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
