import { useCallback, useEffect, useMemo, useState } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { useAuth } from '@/contexts/useAuth';
import {
  Receita,
  ReceitaContaOpcao,
  ReceitaFilters,
  ReceitaFormPayload,
  ReceitaKpis,
  ReceitaSetorOpcao,
  ReceitaUnidadeOpcao,
} from '@/types/receitas';

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createDefaultFilters = (): ReceitaFilters => {
  const today = new Date();

  return {
    dataInicio: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    dataFim: formatDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    buscaGeral: '',
    unidade: [],
    centroCusto: [],
    contaAnalitica: [],
    banco: [],
    clienteOrigem: [],
    forma: [],
  };
};

const normalizeSearch = (value: string | number | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

export function useReceitas() {
  const { user } = useAuth();
  const [data, setData] = useState<Receita[]>([]);
  const [opcoesContas, setOpcoesContas] = useState<ReceitaContaOpcao[]>([]);
  const [opcoesUnidades, setOpcoesUnidades] = useState<ReceitaUnidadeOpcao[]>([]);
  const [opcoesSetores, setOpcoesSetores] = useState<ReceitaSetorOpcao[]>([]);
  const [filters, setFiltersState] = useState<ReceitaFilters>(createDefaultFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let allData: Receita[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const { data: rows, error: fetchError } = await externalSupabase
          .from('vw_receitas_plano_contas')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('data_recebimento', { ascending: false })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });

        if (fetchError) throw fetchError;
        if (!rows || rows.length === 0) break;

        allData = allData.concat(rows as Receita[]);
        if (rows.length < pageSize) break;
        page++;
      }

      setData(allData);
    } catch (err: any) {
      console.error('Erro ao buscar receitas:', err);
      setError(err.message || 'Erro ao carregar receitas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOpcoesContas = useCallback(async () => {
    const { data: rows, error: fetchError } = await externalSupabase
      .from('vw_plano_contas_relatorio')
      .select('conta_id, conta_codigo, conta_descricao, conta_natureza, conta_ordem')
      .in('conta_natureza', ['Receita', 'Dedução'])
      .order('conta_codigo', { ascending: true });

    if (fetchError) {
      console.error('Erro ao buscar contas de receita:', fetchError);
      return;
    }

    setOpcoesContas((rows || []).map((row: any) => ({
      id: row.conta_id,
      nome: `${row.conta_codigo} - ${row.conta_descricao}`,
      codigo: row.conta_codigo,
      descricao: row.conta_descricao,
      natureza: row.conta_natureza,
      ordem: row.conta_ordem ?? null,
    })));
  }, []);

  const fetchOpcoesUnidades = useCallback(async () => {
    const { data: rows, error: fetchError } = await externalSupabase
      .from('unidades')
      .select('codigo, unidade')
      .eq('ativo', true);

    if (fetchError) {
      console.error('Erro ao buscar unidades:', fetchError);
      return;
    }

    setOpcoesUnidades(((rows || []) as ReceitaUnidadeOpcao[]).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })
    ));
  }, []);

  const fetchOpcoesSetores = useCallback(async () => {
    const { data: rows, error: fetchError } = await externalSupabase
      .from('setor')
      .select('codigo, setor')
      .eq('ativo', true);

    if (fetchError) {
      console.error('Erro ao buscar setores:', fetchError);
      return;
    }

    setOpcoesSetores(((rows || []) as ReceitaSetorOpcao[]).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })
    ));
  }, []);

  useEffect(() => {
    fetchOpcoesContas();
    fetchOpcoesUnidades();
    fetchOpcoesSetores();
  }, [fetchOpcoesContas, fetchOpcoesSetores, fetchOpcoesUnidades]);


  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (filters.dataInicio && row.data_recebimento < filters.dataInicio) return false;
      if (filters.dataFim && row.data_recebimento > filters.dataFim) return false;
      if (filters.unidade.length > 0 && !filters.unidade.includes(row.unidade_nome || '')) return false;
      if (filters.centroCusto.length > 0 && !filters.centroCusto.includes(row.setor_nome || '')) return false;
      if (filters.contaAnalitica.length > 0 && !filters.contaAnalitica.includes(row.conta_analitica)) return false;
      if (filters.banco.length > 0 && !filters.banco.includes(row.banco || '')) return false;
      if (filters.clienteOrigem.length > 0 && !filters.clienteOrigem.some(value => value === row.cliente || value === row.rateio_cliente_geral)) return false;
      if (filters.forma.length > 0 && !filters.forma.includes(row.forma_recebimento || '')) return false;

      const busca = normalizeSearch(filters.buscaGeral.trim());
      if (busca) {
        const conteudoPesquisavel = [
          row.data_recebimento,
          row.nome,
          row.cliente,
          row.rateio_cliente_geral,
          row.unidade_codigo,
          row.unidade_nome,
          row.setor_codigo,
          row.setor_nome,
          row.conta_analitica,
          row.conta_natureza,
          row.banco,
          row.forma_recebimento,
          row.documento,
          row.descricao,
          row.valor,
        ].map(normalizeSearch).join(' ');

        if (!conteudoPesquisavel.includes(busca)) return false;
      }

      return true;
    });
  }, [data, filters]);

  const kpis = useMemo<ReceitaKpis>(() => {
    let totalReceitas = 0;
    let totalDeducoes = 0;

    filteredData.forEach(row => {
      const valor = Number(row.valor) || 0;
      if (row.conta_natureza === 'Dedução') totalDeducoes += valor;
      else totalReceitas += valor;
    });

    return {
      totalRegistros: filteredData.length,
      totalReceitas,
      totalDeducoes,
      receitaLiquida: totalReceitas - totalDeducoes,
    };
  }, [filteredData]);

  const submitReceita = useCallback(async (payload: ReceitaFormPayload) => {
    if (!user?.id) throw new Error('Usuário não autenticado.');
    const { editar_lote, ...dados } = payload;
    const { error: saveError } = await externalSupabase.rpc('salvar_receita_com_rateios', {
      p_dados: dados, p_receita_id: null, p_editar_lote: false,
    });
    if (saveError) throw new Error(saveError.message);
    await fetchData();
  }, [fetchData, user?.id]);

  const updateReceita = useCallback(async (id: string, payload: ReceitaFormPayload) => {
    if (!user?.id) throw new Error('Usuário não autenticado.');
    const { editar_lote = false, ...dados } = payload;
    const { error: saveError } = await externalSupabase.rpc('salvar_receita_com_rateios', {
      p_dados: dados, p_receita_id: id, p_editar_lote: editar_lote,
    });
    if (saveError) throw new Error(saveError.message);
    await fetchData();
  }, [fetchData, user?.id]);

  const setFilters = (next: Partial<ReceitaFilters>) => {
    setFiltersState(prev => ({ ...prev, ...next }));
  };

  const clearFilters = () => setFiltersState(createDefaultFilters());

  return {
    data: filteredData,
    allData: data,
    opcoesContas,
    opcoesUnidades,
    opcoesSetores,
    filters,
    setFilters,
    clearFilters,
    fetchData,
    submitReceita,
    updateReceita,
    isLoading,
    error,
    kpis,
  };
}
