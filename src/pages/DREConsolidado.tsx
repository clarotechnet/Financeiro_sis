import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChevronLeft, ChevronRight, Download, FileBarChart, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/comissionamento/LoadingSpinner';
import { externalSupabase } from '@/integrations/supabase/externalClient';

type DreLinhaTipo = 'grupo' | 'contas' | 'subtotal' | 'resultado';

interface DreLinha {
  dre_linha_id: string;
  codigo: string;
  descricao: string;
  ordem: number;
  nivel: number;
  tipo: DreLinhaTipo;
  sinal: number;
  total: number | null;
}

interface DreMovimento {
  id: string;
  origem_id: string | null;
  data_movimento: string | null;
  descricao: string | null;
  valor: number | null;
  plano_conta_id: string | null;
  unidade_codigo: string | null;
  unidade_nome: string | null;
  setor_codigo: string | null;
  setor_nome: string | null;
  origem: string;
  conta_codigo: string | null;
  conta_descricao: string | null;
  conta_natureza: string | null;
  subgrupo_codigo: string | null;
  subgrupo_descricao: string | null;
  grupo_codigo: string | null;
  grupo_descricao: string | null;
  dre_linha_id: string | null;
  dre_linha_codigo: string | null;
  dre_linha_descricao: string | null;
  dre_linha_ordem: number | null;
}

interface OpcaoCodigoNome {
  codigo: string;
  nome: string;
}

interface PlanoContaOpcao {
  id: string;
  codigo: string;
  descricao: string;
  nivel: number;
  e_analitica: boolean;
}

interface DreContaDetalhe {
  conta_codigo: string;
  conta_descricao: string;
  total: number;
}

type DreDisplayRowKind = 'linha' | 'detalhe' | 'resultado_financeiro_zero';

interface DreDisplayRow {
  key: string;
  kind: DreDisplayRowKind;
  codigo?: string;
  descricao: string;
  total: number;
  nivel: number;
  tipo?: DreLinhaTipo;
}

const PAGE_SIZE = 50;
const PDF_MARGIN = 12;
const PDF_HEADER_BOTTOM = 30;

const fmtBRL = (value: number) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtBRLDre = (value: number) => {
  if (value < 0) return `(${fmtBRL(Math.abs(value))})`;
  return fmtBRL(value);
};

const fmtDate = (date: string | null | undefined) => {
  if (!date) return '-';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('pt-BR');
};

const contaLabel = (movimento: DreMovimento) => {
  if (movimento.conta_codigo && movimento.conta_descricao) {
    return `${movimento.conta_codigo} - ${movimento.conta_descricao}`;
  }
  return 'Sem conta analítica';
};

const planoContaLabel = (opcao: PlanoContaOpcao | undefined) => {
  if (!opcao) return '';
  return `${opcao.codigo} - ${opcao.descricao}`;
};

const dreDescricaoLabel = (row: DreLinha) => {
  if (row.codigo === '02') return '(-) CUSTOS';
  if (row.codigo === '03') return '(-) DESPESAS OPERACIONAIS';
  if (row.codigo === '04.02') return '(-) Despesas Financeiras';
  return row.descricao;
};

const computeDreTotals = (rows: DreLinha[]): DreLinha[] => {
  const totals = new Map(rows.map(row => [row.codigo, Number(row.total) || 0]));
  const value = (codigo: string) => totals.get(codigo) || 0;

  totals.set('01.99', value('01.01') + value('01.02'));
  totals.set('02.99', value('01.99') + value('02.01'));
  totals.set('03.99', value('02.99') + value('03.01') + value('03.02'));
  totals.set('04.99', value('03.99') + value('04.01') + value('04.02'));

  return rows.map(row => ({
    ...row,
    total: totals.get(row.codigo) || 0,
  }));
};

const hasValue = (value: number) => Math.abs(value) >= 0.005;

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

const addDrePdfHeader = (
  doc: jsPDF,
  logoDataUrl: string | null,
  generatedAt: string,
  rowCount: number,
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
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text('DRE - DEMONSTRATIVO DO RESULTADO', pageWidth / 2, 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(`Gerado em: ${generatedAt}`, pageWidth - PDF_MARGIN, 12, { align: 'right' });
  doc.text(`${rowCount} linha(s)`, pageWidth - PDF_MARGIN, 17, { align: 'right' });

  doc.setDrawColor(220, 53, 69);
  doc.setLineWidth(0.3);
  doc.line(PDF_MARGIN, 25, pageWidth - PDF_MARGIN, 25);
  doc.setTextColor(0);
};

const fetchMovimentosDre = async (
  dataInicio: string,
  dataFim: string,
  unidadeCodigo: string,
  setorCodigo: string,
  grupoCodigo: string,
  subgrupoCodigo: string,
  contaCodigo: string,
) => {
  const allRows: DreMovimento[] = [];
  let page = 0;

  while (true) {
    let query = externalSupabase
      .from('vw_movimentos_dre')
      .select('*')
      .range(page * 1000, (page + 1) * 1000 - 1)
      .order('data_movimento', { ascending: false });

    if (dataInicio) query = query.gte('data_movimento', dataInicio);
    if (dataFim) query = query.lte('data_movimento', dataFim);
    if (unidadeCodigo) query = query.eq('unidade_codigo', unidadeCodigo);
    if (setorCodigo) query = query.eq('setor_codigo', setorCodigo);
    if (grupoCodigo) query = query.eq('grupo_codigo', grupoCodigo);
    if (subgrupoCodigo) query = query.eq('subgrupo_codigo', subgrupoCodigo);
    if (contaCodigo) query = query.eq('conta_codigo', contaCodigo);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...(data as DreMovimento[]));
    if (data.length < 1000) break;
    page++;
  }

  return allRows;
};

const DREConsolidado: React.FC = () => {
  const [linhas, setLinhas] = useState<DreLinha[]>([]);
  const [movimentos, setMovimentos] = useState<DreMovimento[]>([]);
  const [opcoesUnidades, setOpcoesUnidades] = useState<OpcaoCodigoNome[]>([]);
  const [opcoesSetores, setOpcoesSetores] = useState<OpcaoCodigoNome[]>([]);
  const [opcoesPlanoContas, setOpcoesPlanoContas] = useState<PlanoContaOpcao[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [unidadeCodigo, setUnidadeCodigo] = useState('');
  const [setorCodigo, setSetorCodigo] = useState('');
  const [grupoCodigo, setGrupoCodigo] = useState('');
  const [subgrupoCodigo, setSubgrupoCodigo] = useState('');
  const [contaCodigo, setContaCodigo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const fetchOpcoes = useCallback(async () => {
    const [unidadesResult, setoresResult, planoContasResult] = await Promise.all([
      externalSupabase
        .from('unidades')
        .select('codigo, unidade')
        .eq('ativo', true)
        .order('codigo', { ascending: true }),
      externalSupabase
        .from('setor')
        .select('codigo, setor')
        .eq('ativo', true)
        .order('codigo', { ascending: true }),
      externalSupabase
        .from('plano_contas')
        .select('id, codigo, descricao, nivel, e_analitica')
        .eq('ativo', true)
        .order('codigo', { ascending: true }),
    ]);

    if (unidadesResult.error) throw unidadesResult.error;
    if (setoresResult.error) throw setoresResult.error;
    if (planoContasResult.error) throw planoContasResult.error;

    setOpcoesUnidades((unidadesResult.data || []).map((row: any) => ({
      codigo: row.codigo,
      nome: row.unidade,
    })));

    setOpcoesSetores((setoresResult.data || []).map((row: any) => ({
      codigo: row.codigo,
      nome: row.setor,
    })));

    setOpcoesPlanoContas((planoContasResult.data || []) as PlanoContaOpcao[]);
  }, []);

  const fetchDre = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = {
        p_data_inicio: dataInicio || null,
        p_data_fim: dataFim || null,
        p_unidade_codigo: unidadeCodigo || null,
        p_setor_codigo: setorCodigo || null,
      };

      const [dreResult, movimentosRows] = await Promise.all([
        externalSupabase.rpc('gerar_dre', params),
        fetchMovimentosDre(
          dataInicio,
          dataFim,
          unidadeCodigo,
          setorCodigo,
          grupoCodigo,
          subgrupoCodigo,
          contaCodigo,
        ),
      ]);

      if (dreResult.error) throw dreResult.error;

      setLinhas((dreResult.data || []) as DreLinha[]);
      setMovimentos(movimentosRows);
      setGeneratedAt(new Date());
    } catch (err: any) {
      console.error('Erro ao gerar DRE:', err);
      setError(err.message || 'Erro ao gerar DRE');
    } finally {
      setIsLoading(false);
    }
  }, [contaCodigo, dataFim, dataInicio, grupoCodigo, setorCodigo, subgrupoCodigo, unidadeCodigo]);

  useEffect(() => {
    fetchOpcoes().catch((err: any) => {
      console.error('Erro ao carregar filtros da DRE:', err);
      setError(err.message || 'Erro ao carregar filtros da DRE');
    });
  }, [fetchOpcoes]);

  useEffect(() => {
    fetchDre();
  }, [fetchDre]);

  const opcoesContasGerais = useMemo(
    () => opcoesPlanoContas.filter(opcao => opcao.nivel === 1),
    [opcoesPlanoContas],
  );

  const opcoesSubgrupos = useMemo(
    () => opcoesPlanoContas.filter(opcao =>
      opcao.nivel === 2 && (!grupoCodigo || opcao.codigo.slice(0, 2) === grupoCodigo.slice(0, 2))
    ),
    [grupoCodigo, opcoesPlanoContas],
  );

  const opcoesContasAnaliticas = useMemo(
    () => opcoesPlanoContas.filter(opcao =>
      opcao.e_analitica
      && (!grupoCodigo || opcao.codigo.slice(0, 2) === grupoCodigo.slice(0, 2))
      && (!subgrupoCodigo || opcao.codigo.slice(0, 5) === subgrupoCodigo.slice(0, 5))
    ),
    [grupoCodigo, opcoesPlanoContas, subgrupoCodigo],
  );

  const linhasComTotaisFiltrados = useMemo(() => {
    const totaisPorLinha = new Map<string, number>();

    movimentos.forEach(movimento => {
      if (!movimento.dre_linha_id) return;
      const totalAtual = totaisPorLinha.get(movimento.dre_linha_id) || 0;
      totaisPorLinha.set(movimento.dre_linha_id, totalAtual + (Number(movimento.valor) || 0));
    });

    return linhas.map(row => ({
      ...row,
      total: totaisPorLinha.get(row.dre_linha_id) || 0,
    }));
  }, [linhas, movimentos]);

  const linhasCalculadas = useMemo(() => computeDreTotals(linhasComTotaisFiltrados), [linhasComTotaisFiltrados]);
  const totalByCodigo = useMemo(
    () => new Map(linhasCalculadas.map(row => [row.codigo, Number(row.total) || 0])),
    [linhasCalculadas],
  );

  const detalhesPorLinha = useMemo(() => {
    const grouped = new Map<string, Map<string, DreContaDetalhe>>();

    movimentos.forEach(movimento => {
      if (!movimento.dre_linha_id || !movimento.conta_codigo) return;

      const lineMap = grouped.get(movimento.dre_linha_id) || new Map<string, DreContaDetalhe>();
      const current = lineMap.get(movimento.conta_codigo) || {
        conta_codigo: movimento.conta_codigo,
        conta_descricao: movimento.conta_descricao || movimento.conta_codigo,
        total: 0,
      };

      current.total += Number(movimento.valor) || 0;
      lineMap.set(movimento.conta_codigo, current);
      grouped.set(movimento.dre_linha_id, lineMap);
    });

    const result = new Map<string, DreContaDetalhe[]>();
    grouped.forEach((lineMap, dreLinhaId) => {
      result.set(
        dreLinhaId,
        Array.from(lineMap.values())
          .filter(item => hasValue(item.total))
          .sort((a, b) => a.conta_codigo.localeCompare(b.conta_codigo, 'pt-BR', { numeric: true })),
      );
    });

    return result;
  }, [movimentos]);

  const shouldShowResultadoFinanceiro = useMemo(
    () => hasValue((totalByCodigo.get('04.01') || 0) + (totalByCodigo.get('04.02') || 0)),
    [totalByCodigo],
  );

  const linhasDreExibidas = useMemo(
    () => linhasCalculadas.filter(row => {
      if (['04', '04.01', '04.02'].includes(row.codigo)) {
        return shouldShowResultadoFinanceiro;
      }

      if (row.tipo === 'contas') {
        const detalhes = detalhesPorLinha.get(row.dre_linha_id) || [];
        return detalhes.length > 0 || hasValue(Number(row.total) || 0);
      }

      return true;
    }),
    [detalhesPorLinha, linhasCalculadas, shouldShowResultadoFinanceiro],
  );

  const dreDisplayRows = useMemo(() => {
    const rows: DreDisplayRow[] = [];

    linhasDreExibidas.forEach(row => {
      if (row.codigo === '04.99' && !shouldShowResultadoFinanceiro) {
        rows.push({
          key: 'resultado-financeiro-zero',
          kind: 'resultado_financeiro_zero',
          descricao: 'Resultado Financeiro',
          total: 0,
          nivel: 1,
          tipo: 'subtotal',
        });
      }

      rows.push({
        key: row.dre_linha_id,
        kind: 'linha',
        codigo: row.codigo,
        descricao: `${row.tipo === 'subtotal' || row.tipo === 'resultado' ? '= ' : ''}${dreDescricaoLabel(row)}`,
        total: Number(row.total) || 0,
        nivel: row.nivel,
        tipo: row.tipo,
      });

      if (row.tipo === 'contas') {
        (detalhesPorLinha.get(row.dre_linha_id) || []).forEach(item => {
          rows.push({
            key: `${row.dre_linha_id}-${item.conta_codigo}`,
            kind: 'detalhe',
            descricao: item.conta_descricao,
            total: item.total,
            nivel: row.nivel + 1,
          });
        });
      }
    });

    return rows;
  }, [detalhesPorLinha, linhasDreExibidas, shouldShowResultadoFinanceiro]);

  const movimentosPendentes = useMemo(
    () => movimentos.filter(row => !row.dre_linha_id),
    [movimentos],
  );

  const totalPages = Math.max(1, Math.ceil(movimentos.length / PAGE_SIZE));
  const pageData = useMemo(
    () => movimentos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [movimentos, page],
  );
  const pageStart = movimentos.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, movimentos.length);

  useEffect(() => {
    setPage(0);
  }, [movimentos]);

  useEffect(() => {
    setPage(current => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const periodoLabel = dataInicio || dataFim
    ? `${dataInicio ? fmtDate(dataInicio) : 'início'} até ${dataFim ? fmtDate(dataFim) : 'fim'}`
    : 'Todos os períodos';

  const unidadeLabel = opcoesUnidades.find(opcao => opcao.codigo === unidadeCodigo)?.nome || 'Todas as unidades';
  const setorLabel = opcoesSetores.find(opcao => opcao.codigo === setorCodigo)?.nome || 'Todos os setores';
  const contaGeralLabel = planoContaLabel(opcoesContasGerais.find(opcao => opcao.codigo === grupoCodigo)) || 'Todas as contas gerais';
  const subgrupoLabel = planoContaLabel(opcoesSubgrupos.find(opcao => opcao.codigo === subgrupoCodigo)) || 'Todos os subgrupos';
  const contaAnaliticaLabel = planoContaLabel(opcoesContasAnaliticas.find(opcao => opcao.codigo === contaCodigo)) || 'Todas as contas analíticas';

  const handleGrupoChange = (value: string) => {
    setGrupoCodigo(value);
    setSubgrupoCodigo('');
    setContaCodigo('');
  };

  const handleSubgrupoChange = (value: string) => {
    setSubgrupoCodigo(value);
    setContaCodigo('');
  };

  const limpar = () => {
    setDataInicio('');
    setDataFim('');
    setUnidadeCodigo('');
    setSetorCodigo('');
    setGrupoCodigo('');
    setSubgrupoCodigo('');
    setContaCodigo('');
  };

  const handleExportPdf = async () => {
    if (exportingPdf || dreDisplayRows.length === 0) {
      if (dreDisplayRows.length === 0) alert('Sem dados para exportar.');
      return;
    }

    setExportingPdf(true);
    try {
      const generatedAtLabel = new Date().toLocaleString('pt-BR');
      const logoDataUrl = await loadLogoDataUrl();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      const addReportIntro = () => {
        let y = PDF_HEADER_BOTTOM;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(20);
        doc.text('Resumo dos filtros', PDF_MARGIN, y);

        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(90);

        const filters = [
          `Periodo: ${periodoLabel}`,
          `Unidade: ${unidadeLabel}`,
          `Setor: ${setorLabel}`,
          `Conta Geral: ${contaGeralLabel}`,
          `Subgrupo: ${subgrupoLabel}`,
          `Conta Analitica: ${contaAnaliticaLabel}`,
        ];

        filters.forEach(filter => {
          doc.text(filter, PDF_MARGIN, y, { maxWidth: pageWidth - PDF_MARGIN * 2 });
          y += 4;
        });

        return y + 3;
      };

      addDrePdfHeader(doc, logoDataUrl, generatedAtLabel, dreDisplayRows.length);
      const tableStartY = addReportIntro();

      autoTable(doc, {
        startY: tableStartY,
        head: [['Descricao', 'Valor']],
        body: dreDisplayRows.map(row => [
          row.descricao,
          row.kind === 'linha' && row.tipo === 'grupo' ? '' : fmtBRLDre(row.total),
        ]),
        margin: { top: PDF_HEADER_BOTTOM, right: PDF_MARGIN, bottom: 14, left: PDF_MARGIN },
        styles: {
          fontSize: 8,
          cellPadding: 1.6,
          overflow: 'linebreak',
          valign: 'middle',
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        headStyles: { fillColor: [31, 58, 95], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: pageWidth - PDF_MARGIN * 2 - 42 },
          1: { cellWidth: 42, halign: 'right' },
        },
        didParseCell: data => {
          if (data.section !== 'body') return;

          const row = dreDisplayRows[data.row.index];
          const isGrupo = row.kind === 'linha' && row.tipo === 'grupo';
          const isDetail = row.kind === 'detalhe';
          const isResult = row.kind === 'resultado_financeiro_zero' || row.tipo === 'subtotal' || row.tipo === 'resultado';

          if (isGrupo) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.textColor = [15, 23, 42];
          }

          if (isDetail) {
            data.cell.styles.fontSize = 7;
            data.cell.styles.textColor = [71, 85, 105];
          }

          if (isResult) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [245, 245, 245];
          }

          if (data.column.index === 0) {
            (data.cell.styles as any).cellPadding = {
              top: 1.6,
              right: 1.6,
              bottom: 1.6,
              left: 2 + Math.max(row.nivel - 1, 0) * 6 + (isDetail ? 4 : 0),
            };
          }

          if (data.column.index === 1 && row.total < 0) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        didDrawPage: () => {
          addDrePdfHeader(doc, logoDataUrl, generatedAtLabel, dreDisplayRows.length);
        },
      });

      doc.save(`dre-consolidado-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    if (dreDisplayRows.length === 0) {
      alert('Sem dados para exportar.');
      return;
    }

    const dreRows = dreDisplayRows.map(row => ({
      Código: row.codigo,
      Descrição: row.descricao,
      Tipo: row.kind === 'detalhe' ? 'conta_analitica' : row.tipo || row.kind,
      Total: row.kind === 'linha' && row.tipo === 'grupo' ? null : Number(row.total) || 0,
    }));

    const detalheRows = movimentos.map(row => ({
      Data: fmtDate(row.data_movimento),
      Descrição: row.descricao || '-',
      Unidade: row.unidade_nome || row.unidade_codigo || '-',
      Setor: row.setor_nome || row.setor_codigo || '-',
      'Conta Analítica': contaLabel(row),
      'Linha DRE': row.dre_linha_codigo && row.dre_linha_descricao
        ? `${row.dre_linha_codigo} - ${row.dre_linha_descricao}`
        : 'Sem linha DRE',
      Valor: Number(row.valor) || 0,
    }));

    const wb = XLSX.utils.book_new();
    const wsDre = XLSX.utils.json_to_sheet(dreRows);
    wsDre['!cols'] = [{ wch: 12 }, { wch: 42 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDre, 'DRE');

    const wsDetalhe = XLSX.utils.json_to_sheet(detalheRows);
    wsDetalhe['!cols'] = [
      { wch: 12 },
      { wch: 42 },
      { wch: 24 },
      { wch: 28 },
      { wch: 42 },
      { wch: 32 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetalhe, 'Movimentos');

    XLSX.writeFile(wb, `DRE_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-full">
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #111827 !important;
          }

          .dre-no-print,
          .app-sidebar,
          aside,
          nav {
            display: none !important;
          }

          .dre-print-page {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }

          .dre-report-card {
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #111827 !important;
            padding: 0 !important;
          }

          .dre-report-card::before {
            display: none !important;
          }

          .dre-print-table th,
          .dre-print-table td {
            color: #111827 !important;
            border-color: #d1d5db !important;
          }
        }
      `}</style>

      <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-6 dre-print-page">
        <div className="flex items-center justify-between gap-4 dre-no-print">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-glow"
              style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
            >
              <FileBarChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-foreground">DRE Consolidado</h1>
              <p className="text-sm text-muted-foreground">Demonstrativo do resultado por plano de contas</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDre} className="gap-1">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>

        {error && (
          <div className="alert alert-error dre-no-print">
            <span>Erro ao carregar DRE: {error}</span>
          </div>
        )}

        <div className="card dre-no-print" style={{ position: 'relative', zIndex: 10 }}>
          <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
            <h3 className="text-lg font-bold text-foreground">Filtros</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1">
                <Download className="w-4 h-4" /> Exportar Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={exportingPdf || dreDisplayRows.length === 0}
                className="gap-1"
              >
                <FileText className="w-4 h-4" /> {exportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
              </Button>
              <Button size="sm" onClick={fetchDre} className="gap-1">
                <FileSpreadsheet className="w-4 h-4" /> Gerar DRE
              </Button>
              <Button variant="outline" size="sm" onClick={limpar}>
                Limpar
              </Button>
            </div>
          </div>

          <div className="filter-section">
            <div className="form-group">
              <Label className="form-label">Data Inicial</Label>
              <input
                type="date"
                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                value={dataInicio}
                onChange={event => setDataInicio(event.target.value)}
              />
            </div>
            <div className="form-group">
              <Label className="form-label">Data Final</Label>
              <input
                type="date"
                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                value={dataFim}
                onChange={event => setDataFim(event.target.value)}
              />
            </div>
            <div className="form-group">
              <Label className="form-label">Unidade</Label>
              <select
                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                value={unidadeCodigo}
                onChange={event => setUnidadeCodigo(event.target.value)}
              >
                <option value="">Todas</option>
                {opcoesUnidades.map(opcao => (
                  <option key={opcao.codigo} value={opcao.codigo}>{opcao.nome}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <Label className="form-label">Setor</Label>
              <select
                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                value={setorCodigo}
                onChange={event => setSetorCodigo(event.target.value)}
              >
                <option value="">Todos</option>
                {opcoesSetores.map(opcao => (
                  <option key={opcao.codigo} value={opcao.codigo}>{opcao.nome}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <Label className="form-label">Conta Geral</Label>
              <select
                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                value={grupoCodigo}
                onChange={event => handleGrupoChange(event.target.value)}
              >
                <option value="">Todas</option>
                {opcoesContasGerais.map(opcao => (
                  <option key={opcao.codigo} value={opcao.codigo}>{planoContaLabel(opcao)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <Label className="form-label">Subgrupo</Label>
              <select
                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                value={subgrupoCodigo}
                onChange={event => handleSubgrupoChange(event.target.value)}
              >
                <option value="">Todos</option>
                {opcoesSubgrupos.map(opcao => (
                  <option key={opcao.codigo} value={opcao.codigo}>{planoContaLabel(opcao)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <Label className="form-label">Conta Analítica</Label>
              <select
                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                value={contaCodigo}
                onChange={event => setContaCodigo(event.target.value)}
              >
                <option value="">Todas</option>
                {opcoesContasAnaliticas.map(opcao => (
                  <option key={opcao.codigo} value={opcao.codigo}>{planoContaLabel(opcao)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 dre-no-print">
              <div className="card">
                <div className="text-xs text-muted-foreground">Receita Líquida</div>
                <div className="text-xl font-extrabold text-emerald-500 mt-1">{fmtBRLDre(totalByCodigo.get('01.99') || 0)}</div>
              </div>
              <div className="card">
                <div className="text-xs text-muted-foreground">Lucro Bruto</div>
                <div className="text-xl font-extrabold text-primary mt-1">{fmtBRLDre(totalByCodigo.get('02.99') || 0)}</div>
              </div>
              <div className="card">
                <div className="text-xs text-muted-foreground">EBITDA</div>
                <div className="text-xl font-extrabold text-primary mt-1">{fmtBRLDre(totalByCodigo.get('03.99') || 0)}</div>
              </div>
              <div className="card">
                <div className="text-xs text-muted-foreground">Resultado Líquido</div>
                <div className="text-xl font-extrabold text-primary mt-1">{fmtBRLDre(totalByCodigo.get('04.99') || 0)}</div>
              </div>
            </div>

            <div className="card dre-report-card">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">DRE - Demonstrativo do Resultado</h2>
                  <p className="text-sm text-muted-foreground">Período: {periodoLabel}</p>
                  <p className="text-sm text-muted-foreground">Unidade: {unidadeLabel}</p>
                  <p className="text-sm text-muted-foreground">Setor: {setorLabel}</p>
                  <p className="text-sm text-muted-foreground">Conta Geral: {contaGeralLabel}</p>
                  <p className="text-sm text-muted-foreground">Subgrupo: {subgrupoLabel}</p>
                  <p className="text-sm text-muted-foreground">Conta Analítica: {contaAnaliticaLabel}</p>
                </div>
              <div className="text-xs text-muted-foreground md:text-right">
                <div>{movimentos.length} movimento(s) analisado(s)</div>
                <div>{movimentosPendentes.length} sem linha DRE</div>
                {generatedAt && <div>Gerado em {generatedAt.toLocaleString('pt-BR')}</div>}
              </div>
            </div>

            {movimentosPendentes.length > 0 && (
              <div className="dre-no-print mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                DRE parcial: {movimentosPendentes.length} movimento(s) ainda estao sem linha DRE e nao entram nos totais.
                Revise a tabela de movimentos abaixo para mapear essas contas.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm dre-print-table">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 px-2">Descrição</th>
                    <th className="py-2 px-2 text-right w-48">Valor</th>
                  </tr>
                </thead>
                  <tbody>
                    {dreDisplayRows.map(row => {
                      const total = Number(row.total) || 0;
                      const isGrupo = row.kind === 'linha' && row.tipo === 'grupo';
                      const isDetail = row.kind === 'detalhe';
                      const isTotal = row.kind === 'resultado_financeiro_zero' || row.tipo === 'subtotal' || row.tipo === 'resultado';

                      return (
                        <tr
                          key={row.key}
                          className={[
                            'border-b border-border/40',
                            isGrupo ? 'bg-muted/35 uppercase font-extrabold text-foreground' : '',
                            isDetail ? 'text-xs text-muted-foreground' : '',
                            isTotal ? 'font-extrabold bg-primary/5' : '',
                            row.tipo === 'resultado' ? 'text-primary border-t-2 border-primary/50' : '',
                          ].join(' ')}
                        >
                          <td
                            className={isDetail ? 'py-1.5 px-2' : 'py-2 px-2'}
                            style={{ paddingLeft: `${Math.max(row.nivel - 1, 0) * 24 + (isDetail ? 24 : 8)}px` }}
                          >
                            <span className={isDetail ? 'text-foreground/90' : ''}>{row.descricao}</span>
                          </td>
                          <td className={`${isDetail ? 'py-1.5' : 'py-2'} px-2 text-right font-semibold ${total < 0 ? 'text-red-400' : 'text-foreground'}`}>
                            {isGrupo ? '' : fmtBRLDre(total)}
                          </td>
                        </tr>
                      );
                    })}
                    {dreDisplayRows.length === 0 && (
                      <tr>
                        <td colSpan={2} className="py-6 text-center text-muted-foreground">
                          Nenhuma linha de DRE encontrada. Rode a migration da estrutura da DRE.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card dre-no-print">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Movimentos da DRE</h3>
                  <p className="text-xs text-muted-foreground">
                    Auditoria dos lançamentos usados no demonstrativo. Linhas sem DRE não entram no resultado.
                  </p>
                </div>
                {movimentosPendentes.length > 0 && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/15 text-amber-400">
                    {movimentosPendentes.length} pendente(s) de mapeamento
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 px-2">Data</th>
                      <th className="py-2 px-2">Descrição</th>
                      <th className="py-2 px-2">Unidade</th>
                      <th className="py-2 px-2">Setor</th>
                      <th className="py-2 px-2">Conta Analítica</th>
                      <th className="py-2 px-2">Linha DRE</th>
                      <th className="py-2 px-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map(row => {
                      const total = Number(row.valor) || 0;
                      return (
                        <tr key={row.id} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="py-2 px-2 whitespace-nowrap">{fmtDate(row.data_movimento)}</td>
                          <td className="py-2 px-2 text-foreground">{row.descricao || '-'}</td>
                          <td className="py-2 px-2">{row.unidade_nome || row.unidade_codigo || '-'}</td>
                          <td className="py-2 px-2">{row.setor_nome || row.setor_codigo || '-'}</td>
                          <td className="py-2 px-2">
                            <div className="font-semibold">{contaLabel(row)}</div>
                            <div className="text-xs text-muted-foreground">
                              {[row.grupo_codigo, row.subgrupo_codigo].filter(Boolean).join(' / ') || '-'}
                            </div>
                          </td>
                          <td className="py-2 px-2">
                            {row.dre_linha_codigo && row.dre_linha_descricao ? (
                              <span>{row.dre_linha_codigo} - {row.dre_linha_descricao}</span>
                            ) : (
                              <span className="text-amber-400 font-semibold">Sem linha DRE</span>
                            )}
                          </td>
                          <td className={`py-2 px-2 text-right font-semibold ${total < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {fmtBRLDre(total)}
                          </td>
                        </tr>
                      );
                    })}
                    {movimentos.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-muted-foreground">
                          Sem movimentos para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {movimentos.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Mostrando {pageStart}-{pageEnd} de {movimentos.length} movimento(s)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Página {page + 1} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage(current => Math.max(0, current - 1))}
                        title="Página anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
                        title="Próxima página"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DREConsolidado;
