import { useCallback, useEffect, useRef, useState } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { FluxoCaixaDia, FluxoCaixaPeriodo, FluxoCaixaResumo } from '@/types/fluxoCaixa';

interface ReceitaFluxoRow {
  id?: string;
  created_at?: string;
  data_recebimento: string | null;
  valor: number | string | null;
  conta_natureza: string | null;
}

interface PagamentoFluxoRow {
  id?: string;
  created_at?: string;
  data_lancamento: string | null;
  valor: number | string | null;
  status_pag: string | null;
}

const PAGE_SIZE = 1000;

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getCurrentMonthPeriod = (): FluxoCaixaPeriodo => {
  const today = new Date();
  return {
    dataInicio: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    dataFim: formatDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
};

const normalizeText = (value: string | null | undefined) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const isDeducao = (natureza: string | null | undefined) =>
  normalizeText(natureza) === 'DEDUCAO';

const getDateOnly = (value: string | null | undefined) => {
  const match = (value || '').match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || '';
};

const addToMap = (map: Map<string, number>, key: string, value: number) => {
  if (!key || !Number.isFinite(value)) return;
  map.set(key, (map.get(key) || 0) + value);
};

const eachDate = (start: string, end: string) => {
  const dates: string[] = [];
  const current = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);

  while (current <= last) {
    dates.push(formatDateInput(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const fetchReceitasUntil = async (dataFim: string) => {
  const rows: ReceitaFluxoRow[] = [];
  let page = 0;

  while (true) {
    const { data, error } = await externalSupabase
      .from('vw_receitas_plano_contas')
      .select('id, created_at, data_recebimento, valor, conta_natureza')
      .not('data_recebimento', 'is', null)
      .lte('data_recebimento', dataFim)
      .order('data_recebimento', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data as ReceitaFluxoRow[]);
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }

  return rows;
};

const fetchPagamentosUntil = async (dataFim: string) => {
  const rows: PagamentoFluxoRow[] = [];
  let page = 0;

  while (true) {
    const { data, error } = await externalSupabase
      .from('lancamentos_pix')
      .select('id, created_at, data_lancamento, valor, status_pag')
      .not('data_lancamento', 'is', null)
      .lte('data_lancamento', dataFim)
      .order('data_lancamento', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data as PagamentoFluxoRow[]);
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }

  return rows;
};

const EMPTY_SUMMARY: FluxoCaixaResumo = {
  saldoAbertura: 0,
  totalEntradas: 0,
  pagamentosExatos: 0,
  pagamentosProjetados: 0,
  totalPagamentos: 0,
  saldoFinalProjetado: 0,
  mediaLiquidaDiaria: 0,
};

export function useFluxoCaixa() {
  const [periodo, setPeriodoState] = useState<FluxoCaixaPeriodo>(getCurrentMonthPeriod);
  const [dias, setDias] = useState<FluxoCaixaDia[]>([]);
  const [resumo, setResumo] = useState<FluxoCaixaResumo>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchFluxo = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!periodo.dataInicio || !periodo.dataFim || periodo.dataInicio > periodo.dataFim) {
      setDias([]);
      setResumo(EMPTY_SUMMARY);
      setError('Informe um período válido para gerar o fluxo de caixa.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [receitas, pagamentos] = await Promise.all([
        fetchReceitasUntil(periodo.dataFim),
        fetchPagamentosUntil(periodo.dataFim),
      ]);

      if (requestId !== requestIdRef.current) return;

      const receitasPorDia = new Map<string, number>();
      const pagamentosExatosPorDia = new Map<string, number>();
      const pagamentosProjetadosPorDia = new Map<string, number>();
      let saldoAbertura = 0;

      receitas.forEach(row => {
        const data = getDateOnly(row.data_recebimento);
        const valor = Math.abs(Number(row.valor) || 0) * (isDeducao(row.conta_natureza) ? -1 : 1);

        if (data < periodo.dataInicio) saldoAbertura += valor;
        else addToMap(receitasPorDia, data, valor);
      });

      pagamentos.forEach(row => {
        const data = getDateOnly(row.data_lancamento);
        const valor = Math.abs(Number(row.valor) || 0);
        const status = normalizeText(row.status_pag);

        if (status !== 'PAGO' && status !== 'A PAGAR') return;

        if (data < periodo.dataInicio) {
          saldoAbertura -= valor;
          return;
        }

        if (status === 'PAGO') addToMap(pagamentosExatosPorDia, data, valor);
        else addToMap(pagamentosProjetadosPorDia, data, valor);
      });

      let saldoCorrente = saldoAbertura;
      const fluxoDias = eachDate(periodo.dataInicio, periodo.dataFim).map<FluxoCaixaDia>(data => {
        const saldoInicial = saldoCorrente;
        const entradas = receitasPorDia.get(data) || 0;
        const pagamentosExatos = pagamentosExatosPorDia.get(data) || 0;
        const pagamentosProjetados = pagamentosProjetadosPorDia.get(data) || 0;
        const totalPagamentos = pagamentosExatos + pagamentosProjetados;
        const saldoComEntradas = saldoInicial + entradas;
        const saldoTotalProjetado = saldoComEntradas - totalPagamentos;

        saldoCorrente = saldoTotalProjetado;

        return {
          data,
          saldoInicial,
          receitas: entradas,
          saldoComEntradas,
          pagamentosExatos,
          pagamentosProjetados,
          totalPagamentos,
          saldoTotalProjetado,
        };
      });

      const totalEntradas = fluxoDias.reduce((total, dia) => total + dia.receitas, 0);
      const pagamentosExatos = fluxoDias.reduce((total, dia) => total + dia.pagamentosExatos, 0);
      const pagamentosProjetados = fluxoDias.reduce((total, dia) => total + dia.pagamentosProjetados, 0);
      const totalPagamentos = pagamentosExatos + pagamentosProjetados;

      setDias(fluxoDias);
      setResumo({
        saldoAbertura,
        totalEntradas,
        pagamentosExatos,
        pagamentosProjetados,
        totalPagamentos,
        saldoFinalProjetado: fluxoDias.length > 0
          ? fluxoDias[fluxoDias.length - 1].saldoTotalProjetado
          : saldoAbertura,
        mediaLiquidaDiaria: fluxoDias.length > 0
          ? (totalEntradas - totalPagamentos) / fluxoDias.length
          : 0,
      });
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      console.error('Erro ao carregar fluxo de caixa:', err);
      setDias([]);
      setResumo(EMPTY_SUMMARY);
      setError(err?.message || 'Não foi possível carregar o fluxo de caixa.');
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [periodo.dataFim, periodo.dataInicio]);

  useEffect(() => {
    void fetchFluxo();
  }, [fetchFluxo]);

  const setPeriodo = (updates: Partial<FluxoCaixaPeriodo>) => {
    setPeriodoState(current => ({ ...current, ...updates }));
  };

  return {
    periodo,
    setPeriodo,
    dias,
    resumo,
    isLoading,
    error,
    fetchFluxo,
  };
}
