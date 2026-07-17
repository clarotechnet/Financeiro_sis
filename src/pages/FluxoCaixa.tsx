import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  RefreshCw,
  Scale,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/comissionamento/LoadingSpinner';
import { getCurrentMonthPeriod, useFluxoCaixa } from '@/hooks/useFluxoCaixa';
import { FluxoCaixaDia } from '@/types/fluxoCaixa';

const PDF_MARGIN = 10;
const PDF_HEADER_BOTTOM = 31;

const fmtBRL = (value: number) =>
  (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPagamento = (value: number) => value > 0 ? fmtBRL(-value) : fmtBRL(0);

const parseDate = (value: string) => new Date(`${value}T12:00:00`);

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fmtDate = (value: string) => parseDate(value).toLocaleDateString('pt-BR');

const fmtDay = (value: string) => {
  const date = parseDate(value);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${String(date.getDate()).padStart(2, '0')} ${weekday}`;
};

const getPeriodLabel = (start: string, end: string) => {
  if (!start || !end) return 'Período não informado';

  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const isFullMonth = startDate.getDate() === 1
    && endDate.getFullYear() === startDate.getFullYear()
    && endDate.getMonth() === startDate.getMonth()
    && endDate.getDate() === new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();

  if (isFullMonth) {
    const month = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return month.charAt(0).toUpperCase() + month.slice(1);
  }

  return `${fmtDate(start)} a ${fmtDate(end)}`;
};

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

const buildExportRow = (dia: FluxoCaixaDia) => [
  fmtDay(dia.data),
  dia.saldoInicial,
  dia.receitas,
  dia.saldoComEntradas,
  -dia.pagamentosExatos,
  -dia.pagamentosProjetados,
  -dia.totalPagamentos,
  dia.saldoTotalProjetado,
];

const FluxoCaixa = () => {
  const { periodo, setPeriodo, dias, resumo, isLoading, error, fetchFluxo } = useFluxoCaixa();
  const [exportingPdf, setExportingPdf] = useState(false);
  const periodoLabel = useMemo(
    () => getPeriodLabel(periodo.dataInicio, periodo.dataFim),
    [periodo.dataFim, periodo.dataInicio],
  );

  const setMonth = (offset: number) => {
    const base = periodo.dataInicio ? parseDate(periodo.dataInicio) : new Date();
    const target = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    setPeriodo({
      dataInicio: formatDateInput(target),
      dataFim: formatDateInput(new Date(target.getFullYear(), target.getMonth() + 1, 0)),
    });
  };

  const resetCurrentMonth = () => setPeriodo(getCurrentMonthPeriod());

  const handleExportExcel = () => {
    const headers = [
      'Dia',
      'Saldo Inicial',
      'Receitas',
      'Saldo com Entradas',
      'Pagamentos Exatos',
      'Pagamentos Projetados',
      'Total Pagamentos',
      'Saldo Total Projetado',
    ];
    const totalRow = [
      'TOTAL DO PERÍODO',
      resumo.saldoAbertura,
      resumo.totalEntradas,
      resumo.saldoAbertura + resumo.totalEntradas,
      -resumo.pagamentosExatos,
      -resumo.pagamentosProjetados,
      -resumo.totalPagamentos,
      resumo.saldoFinalProjetado,
    ];
    const sheetData = [
      [`Tabela de Fluxo Financeiro - ${periodoLabel}`],
      [`Período: ${fmtDate(periodo.dataInicio)} a ${fmtDate(periodo.dataFim)}`],
      [],
      headers,
      ...dias.map(buildExportRow),
      totalRow,
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    ];
    ws['!cols'] = [
      { wch: 18 },
      { wch: 19 },
      { wch: 18 },
      { wch: 22 },
      { wch: 21 },
      { wch: 24 },
      { wch: 20 },
      { wch: 24 },
    ];

    const totalRowIndex = 4 + dias.length;
    for (let row = 4; row <= totalRowIndex; row += 1) {
      for (let column = 1; column <= 7; column += 1) {
        const cell = ws[XLSX.utils.encode_cell({ r: row, c: column })];
        if (cell) cell.z = 'R$ #,##0.00;[Red](R$ #,##0.00)';
      }
    }

    const resumoWs = XLSX.utils.aoa_to_sheet([
      ['Resumo do Período', 'Valor'],
      ['Saldo de abertura', resumo.saldoAbertura],
      ['Total de entradas', resumo.totalEntradas],
      ['Pagamentos exatos', -resumo.pagamentosExatos],
      ['Pagamentos projetados', -resumo.pagamentosProjetados],
      ['Total de pagamentos', -resumo.totalPagamentos],
      ['Saldo final projetado', resumo.saldoFinalProjetado],
      ['Média líquida diária', resumo.mediaLiquidaDiaria],
    ]);
    resumoWs['!cols'] = [{ wch: 26 }, { wch: 22 }];
    for (let row = 1; row <= 7; row += 1) {
      const cell = resumoWs[XLSX.utils.encode_cell({ r: row, c: 1 })];
      if (cell) cell.z = 'R$ #,##0.00;[Red](R$ #,##0.00)';
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fluxo Diário');
    XLSX.utils.book_append_sheet(wb, resumoWs, 'Resumo');
    XLSX.writeFile(wb, `fluxo-caixa-${periodo.dataInicio}-a-${periodo.dataFim}.xlsx`);
  };

  const handleExportPdf = async () => {
    if (exportingPdf) return;

    setExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const logoDataUrl = await loadLogoDataUrl();
      const generatedAt = new Date().toLocaleString('pt-BR');

      const addHeader = () => {
        if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', PDF_MARGIN, 6, 15, 15);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(220, 53, 69);
        doc.text('TechNET', PDF_MARGIN + 19, 12);
        doc.setFontSize(7.5);
        doc.setTextColor(90);
        doc.text('Financeiro', PDF_MARGIN + 19, 17);

        doc.setFontSize(13);
        doc.setTextColor(20);
        doc.text('FLUXO DE CAIXA', pageWidth / 2, 12, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(90);
        doc.text(periodoLabel, pageWidth / 2, 17, { align: 'center' });
        doc.text(`Gerado em: ${generatedAt}`, pageWidth - PDF_MARGIN, 11, { align: 'right' });
        doc.text(`${dias.length} dia(s)`, pageWidth - PDF_MARGIN, 16, { align: 'right' });

        doc.setDrawColor(220, 53, 69);
        doc.setLineWidth(0.3);
        doc.line(PDF_MARGIN, 24, pageWidth - PDF_MARGIN, 24);
      };

      addHeader();
      autoTable(doc, {
        startY: PDF_HEADER_BOTTOM,
        head: [[
          'Dia',
          'Saldo Inicial',
          'Receitas',
          'Saldo com Entradas',
          'Pagamentos Exatos',
          'Pagamentos Projetados',
          'Total Pagamentos',
          'Saldo Total Projetado',
        ]],
        body: [
          ...dias.map(dia => [
            fmtDay(dia.data),
            fmtBRL(dia.saldoInicial),
            fmtBRL(dia.receitas),
            fmtBRL(dia.saldoComEntradas),
            fmtPagamento(dia.pagamentosExatos),
            fmtPagamento(dia.pagamentosProjetados),
            fmtPagamento(dia.totalPagamentos),
            fmtBRL(dia.saldoTotalProjetado),
          ]),
          [
            'TOTAL',
            fmtBRL(resumo.saldoAbertura),
            fmtBRL(resumo.totalEntradas),
            fmtBRL(resumo.saldoAbertura + resumo.totalEntradas),
            fmtPagamento(resumo.pagamentosExatos),
            fmtPagamento(resumo.pagamentosProjetados),
            fmtPagamento(resumo.totalPagamentos),
            fmtBRL(resumo.saldoFinalProjetado),
          ],
        ],
        margin: { top: PDF_HEADER_BOTTOM, right: PDF_MARGIN, bottom: 12, left: PDF_MARGIN },
        styles: {
          fontSize: 7.2,
          cellPadding: 1.8,
          valign: 'middle',
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        headStyles: { fillColor: [31, 58, 95], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
        },
        didParseCell: data => {
          if (data.section !== 'body') return;
          const isTotal = data.row.index === dias.length;
          if (isTotal) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [232, 238, 247];
            data.cell.styles.textColor = [15, 23, 42];
          } else if (data.column.index >= 4 && data.column.index <= 6) {
            data.cell.styles.textColor = [220, 38, 38];
          }
        },
        didDrawPage: addHeader,
      });

      doc.save(`fluxo-caixa-${periodo.dataInicio}-a-${periodo.dataFim}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const saldoClass = resumo.saldoFinalProjetado >= 0 ? 'text-emerald-500' : 'text-red-500';
  const mediaClass = resumo.mediaLiquidaDiaria >= 0 ? 'text-emerald-500' : 'text-red-500';

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1500px] space-y-5 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15">
              <Landmark className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground md:text-2xl">Fluxo de Caixa</h1>
              <p className="text-sm text-muted-foreground">Entradas e pagamentos consolidados por dia</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchFluxo} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-foreground">Período</h2>
              <p className="text-xs text-muted-foreground">O saldo anterior ao período é carregado automaticamente.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setMonth(-1)} title="Mês anterior" aria-label="Mês anterior">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={resetCurrentMonth} className="gap-2">
                <CalendarDays className="h-4 w-4" /> Mês atual
              </Button>
              <Button variant="outline" size="icon" onClick={() => setMonth(1)} title="Mês seguinte" aria-label="Mês seguinte">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="fluxo-data-inicio">Data inicial</Label>
              <Input
                id="fluxo-data-inicio"
                type="date"
                value={periodo.dataInicio}
                onChange={event => setPeriodo({ dataInicio: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fluxo-data-fim">Data final</Label>
              <Input
                id="fluxo-data-fim"
                type="date"
                value={periodo.dataFim}
                onChange={event => setPeriodo({ dataFim: event.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isLoading || dias.length === 0} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isLoading || exportingPdf || dias.length === 0} className="gap-2">
                <FileText className="h-4 w-4" /> {exportingPdf ? 'Gerando...' : 'Exportar PDF'}
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground">Resumo do Período</h2>
              <p className="text-xs text-muted-foreground">Saldo de abertura: {fmtBRL(resumo.saldoAbertura)}</p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">{periodoLabel}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-lg border border-border border-t-2 border-t-emerald-500 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Total Entradas</p>
                  <p className="mt-2 text-xl font-extrabold text-emerald-500">{fmtBRL(resumo.totalEntradas)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Receitas líquidas de deduções</p>
                </div>
                <ArrowDownToLine className="h-5 w-5 text-emerald-500" />
              </div>
            </article>

            <article className="rounded-lg border border-border border-t-2 border-t-red-500 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Total Pagamentos</p>
                  <p className="mt-2 text-xl font-extrabold text-red-500">{fmtBRL(resumo.totalPagamentos)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pago {fmtBRL(resumo.pagamentosExatos)} · A pagar {fmtBRL(resumo.pagamentosProjetados)}
                  </p>
                </div>
                <WalletCards className="h-5 w-5 text-red-500" />
              </div>
            </article>

            <article className="rounded-lg border border-border border-t-2 border-t-blue-500 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Saldo Final Projetado</p>
                  <p className={`mt-2 text-xl font-extrabold ${saldoClass}`}>{fmtBRL(resumo.saldoFinalProjetado)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Após entradas e pagamentos do período</p>
                </div>
                <Scale className="h-5 w-5 text-blue-500" />
              </div>
            </article>

            <article className="rounded-lg border border-border border-t-2 border-t-cyan-500 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Média Líquida Diária</p>
                  <p className={`mt-2 text-xl font-extrabold ${mediaClass}`}>{fmtBRL(resumo.mediaLiquidaDiaria)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Movimento líquido dividido pelos dias</p>
                </div>
                <Download className="h-5 w-5 text-cyan-500" />
              </div>
            </article>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="font-bold text-foreground">Tabela de Fluxo Financeiro - {periodoLabel}</h2>
              <p className="text-xs text-muted-foreground">Pagamentos são exibidos como saídas negativas.</p>
            </div>
            <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{dias.length} dia(s)</span>
          </div>

          {isLoading ? (
            <LoadingSpinner message="Calculando fluxo de caixa..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-muted/70 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Dia</th>
                    <th className="px-4 py-3 text-right">Saldo Inicial</th>
                    <th className="px-4 py-3 text-right">Receitas</th>
                    <th className="px-4 py-3 text-right">Saldo com Entradas</th>
                    <th className="px-4 py-3 text-right">Pagamentos Exatos</th>
                    <th className="px-4 py-3 text-right">Pagamentos Projetados</th>
                    <th className="px-4 py-3 text-right">Total Pagamentos</th>
                    <th className="px-4 py-3 text-right">Saldo Total Projetado</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map(dia => (
                    <tr key={dia.data} className="border-t border-border/70 hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">{fmtDay(dia.data)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">{fmtBRL(dia.saldoInicial)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-500">{fmtBRL(dia.receitas)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{fmtBRL(dia.saldoComEntradas)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-red-500">{fmtPagamento(dia.pagamentosExatos)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-amber-500">{fmtPagamento(dia.pagamentosProjetados)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-red-500">{fmtPagamento(dia.totalPagamentos)}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-extrabold ${dia.saldoTotalProjetado >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {fmtBRL(dia.saldoTotalProjetado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-primary/50 bg-muted/60 font-bold">
                  <tr>
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{fmtBRL(resumo.saldoAbertura)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-500">{fmtBRL(resumo.totalEntradas)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{fmtBRL(resumo.saldoAbertura + resumo.totalEntradas)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-red-500">{fmtPagamento(resumo.pagamentosExatos)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-amber-500">{fmtPagamento(resumo.pagamentosProjetados)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-red-500">{fmtPagamento(resumo.totalPagamentos)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right ${saldoClass}`}>{fmtBRL(resumo.saldoFinalProjetado)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FluxoCaixa;

