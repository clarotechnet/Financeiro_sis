import React, { useState, useMemo } from 'react';
import { LancamentoPix, OpcaoSelect } from '@/types/comissionamento';
import { ChevronLeft, ChevronRight, Pencil, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComissionamentoEditDialog } from './ComissionamentoEditDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OpcoesData {
  cnpj: OpcaoSelect[];
  unidade: OpcaoSelect[];
  centro_de_custo: OpcaoSelect[];
  categoria: OpcaoSelect[];
  secao_custeio: OpcaoSelect[];
  centro_custeio: OpcaoSelect[];
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

const renderBreakableText = (value: string) =>
  value.split(/([/-])/).map((part, index) => (
    part === '/' || part === '-'
      ? <React.Fragment key={`${part}-${index}`}>{part}<wbr /></React.Fragment>
      : part
  ));

export const ComissionamentoTable: React.FC<Props> = ({ data, onUpdate, onDelete, opcoes }) => {
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<keyof LancamentoPix>('data_lancamento');
  const [sortAsc, setSortAsc] = useState(false);
  const [editRecord, setEditRecord] = useState<LancamentoPix | null>(null);
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
    { key: 'centro_custeio', label: 'Centro de Custeio' },
    { key: 'centro_de_custo', label: 'Centro de Custo' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'banco', label: 'Banco' },
    { key: 'status_pag', label: 'Status' },
    { key: 'valor', label: 'Valor' },
  ];

  const totalValor = useMemo(() => sorted.reduce((s, r) => s + (r.valor || 0), 0), [sorted]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados Detalhados', 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 25);

    autoTable(doc, {
      startY: 30,
      head: [['Data', 'Cidade/Unidade', 'Favorecido', 'Chave PIX', 'Centro de Custeio', 'Centro de Custo', 'Categoria', 'Banco', 'Status', 'Valor']],
      body: sorted.map(r => [
        formatDate(r.data_lancamento),
        r.unidade || '-',
        r.favorecido || '-',
        r.chave_pix || '-',
        r.centro_custeio || '-',
        r.centro_de_custo || '-',
        r.categoria || '-',
        r.banco || '-',
        r.status_pag || '-',
        fmtBRL(r.valor),
      ]),
      foot: [[
        { content: 'TOTAL GERAL', colSpan: 9, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: fmtBRL(totalValor), styles: { fontStyle: 'bold', halign: 'right' } },
      ]],
      styles: { fontSize: 7 },
      headStyles: { fillColor: [31, 58, 95], textColor: 255 },
      footStyles: { fillColor: [240, 240, 240], textColor: 30 },
      columnStyles: { 9: { halign: 'right' } },
    });

    doc.save(`dados-detalhados-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={exportPDF}>
          <FileText className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="data-table min-w-[1264px] w-full table-fixed text-[11px] [&_th]:px-3 [&_th]:py-3 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top">
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '88px' }} />
              <col style={{ width: '108px' }} />
              <col style={{ width: '190px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '125px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '185px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '78px' }} />
              <col style={{ width: '120px' }} />
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
                  <td className={wrappedCellClass}>{row.centro_custeio || '-'}</td>
                  <td className={wrappedCellClass}>{row.centro_de_custo || '-'}</td>
                  <td className={wrappedCellClass}>{row.categoria ? renderBreakableText(row.categoria) : '-'}</td>
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
    </>
  );
};
