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

const EMPTY_FILTERS: ReceitaFilters = {
  dataInicio: '',
  dataFim: '',
  contaAnalitica: [],
};

export function useReceitas() {
  const { user } = useAuth();
  const [data, setData] = useState<Receita[]>([]);
  const [opcoesContas, setOpcoesContas] = useState<ReceitaContaOpcao[]>([]);
  const [opcoesUnidades, setOpcoesUnidades] = useState<ReceitaUnidadeOpcao[]>([]);
  const [opcoesSetores, setOpcoesSetores] = useState<ReceitaSetorOpcao[]>([]);
  const [filters, setFiltersState] = useState<ReceitaFilters>(EMPTY_FILTERS);
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
          .order('created_at', { ascending: true });

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
      if (filters.contaAnalitica.length > 0 && !filters.contaAnalitica.includes(row.conta_analitica)) return false;
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

    const { deducoes = [], ...receitaPayload } = payload;

    const { data: receitaCriada, error: insertError } = await externalSupabase
      .from('receitas')
      .insert([{
        ...receitaPayload,
        receita_pai_id: null,
        created_by: user.id,
      }])
      .select('id')
      .single();

    if (insertError) throw insertError;

    const deducoesValidas = deducoes.filter(deducao =>
      deducao.plano_conta_id && Number(deducao.valor) > 0
    );

    if (deducoesValidas.length > 0 && receitaCriada?.id) {
      const { error: deducoesError } = await externalSupabase
        .from('receitas')
        .insert(deducoesValidas.map(deducao => ({
          ...receitaPayload,
          plano_conta_id: deducao.plano_conta_id,
          valor: deducao.valor,
          descricao: deducao.descricao || `Dedução vinculada a ${receitaPayload.cliente}`,
          receita_pai_id: receitaCriada.id,
          created_by: user.id,
        })));

      if (deducoesError) {
        await externalSupabase.from('receitas').delete().eq('id', receitaCriada.id);
        throw deducoesError;
      }
    }

    await fetchData();
  }, [fetchData, user?.id]);

  const updateReceita = useCallback(async (id: string, payload: ReceitaFormPayload) => {
    if (!user?.id) throw new Error('Usuário não autenticado.');

    const { deducoes: _deducoes, ...receitaPayload } = payload;

    const { error: updateError } = await externalSupabase
      .from('receitas')
      .update(receitaPayload)
      .eq('id', id);

    if (updateError) throw updateError;
    await fetchData();
  }, [fetchData, user?.id]);

  const setFilters = (next: Partial<ReceitaFilters>) => {
    setFiltersState(prev => ({ ...prev, ...next }));
  };

  const clearFilters = () => setFiltersState(EMPTY_FILTERS);

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
