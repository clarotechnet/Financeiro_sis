import { useState, useCallback, useMemo, useEffect } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import {
  LancamentoPix,
  ComissionamentoFilters,
  ComissionamentoKPIData,
  TechnicianChartData,
  RankingData,
  FrenteKPIData,
  OpcaoSelect,
} from '@/types/comissionamento';

interface OpcoesData {
  cnpj: OpcaoSelect[];
  unidade: OpcaoSelect[];
  centro_de_custo: OpcaoSelect[];
  categoria: OpcaoSelect[];
  secao_custeio: OpcaoSelect[];
  centro_custeio: OpcaoSelect[];
}

const EMPTY_OPCOES: OpcoesData = {
  cnpj: [], unidade: [], centro_de_custo: [],
  categoria: [], secao_custeio: [], centro_custeio: []
};

export function useComissionamento() {
  const [data, setData] = useState<LancamentoPix[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesData>(EMPTY_OPCOES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ComissionamentoFilters>({
    cidade: [], dataInicio: '', dataFim: '', status: [], nome: [],
    frente: [], contrato: [], dataExecInicio: '', dataExecFim: '',
    descricao: '', cnpj: [], centroCusteio: []
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let allData: LancamentoPix[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: rows, error: fetchError } = await externalSupabase
          .from('vw_lancamentos_pix')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('data_lancamento', { ascending: false });

        if (fetchError) throw fetchError;
        if (rows && rows.length > 0) {
          allData = [...allData, ...rows as LancamentoPix[]];
          if (rows.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      setData(allData);
    } catch (err: any) {
      console.error('Erro ao buscar lançamentos PIX:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOpcoes = useCallback(async () => {
    const tables: { key: keyof OpcoesData; table: string }[] = [
      { key: 'cnpj', table: 'opcoes_cnpj' },
      { key: 'unidade', table: 'opcoes_unidade' },
      { key: 'centro_de_custo', table: 'opcoes_centro_de_custo' },
      { key: 'categoria', table: 'opcoes_categoria' },
      { key: 'secao_custeio', table: 'opcoes_secao_custeio' },
      { key: 'centro_custeio', table: 'opcoes_centro_custeio' },
    ];
    const next: OpcoesData = { ...EMPTY_OPCOES };
    await Promise.all(tables.map(async ({ key, table }) => {
      const { data: rows, error: err } = await externalSupabase
        .from(table)
        .select('id, nome, ordem')
        .order('ordem', { ascending: true });
      if (!err && rows) next[key] = rows as OpcaoSelect[];
    }));
    setOpcoes(next);
  }, []);

  useEffect(() => { fetchOpcoes(); }, [fetchOpcoes]);

  const filteredData = useMemo(() => {
    let result = [...data];

    if (filters.cidade.length > 0) {
      result = result.filter(r =>
        filters.cidade.some(c => (r.unidade || '').toLowerCase().includes(c.toLowerCase()))
      );
    }
    if (filters.dataInicio) {
      result = result.filter(r => r.data_lancamento && r.data_lancamento >= filters.dataInicio);
    }
    if (filters.dataFim) {
      result = result.filter(r => r.data_lancamento && r.data_lancamento <= filters.dataFim);
    }
    if (filters.nome.length > 0) {
      result = result.filter(r =>
        filters.nome.some(n => (r.favorecido || '').toLowerCase().includes(n.toLowerCase()))
      );
    }
    if (filters.frente.length > 0) {
      result = result.filter(r => filters.frente.includes(r.categoria || ''));
    }
    if (filters.contrato.length > 0) {
      result = result.filter(r =>
        filters.contrato.some(c => (r.centro_de_custo || '').toLowerCase().includes(c.toLowerCase()))
      );
    }
    if (filters.descricao && filters.descricao.trim()) {
      const q = filters.descricao.trim().toLowerCase();
      result = result.filter(r => (r.descricao || '').toLowerCase().includes(q));
    }
    if (filters.cnpj.length > 0) {
      result = result.filter(r => filters.cnpj.includes(r.cnpj || ''));
    }
    if (filters.centroCusteio.length > 0) {
      result = result.filter(r => filters.centroCusteio.includes(r.centro_custeio || ''));
    }
    return result;
  }, [data, filters]);

  const uniqueCidades = useMemo(
    () => [...new Set(data.map(r => r.unidade).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueNomes = useMemo(
    () => [...new Set(data.map(r => r.favorecido).filter(Boolean))].sort() as string[],
    [data]
  );
  const uniqueFrente = useMemo(
    () => [...new Set(data.map(r => r.categoria).filter(Boolean))].sort() as string[],
    [data]
  );

  // KPIs: total geral + soma por unidade
  const kpis = useMemo<ComissionamentoKPIData>(() => {
    const map = new Map<string, { total: number; valor: number }>();
    let totalValor = 0;
    filteredData.forEach(r => {
      const u = r.unidade || 'Sem Unidade';
      if (!map.has(u)) map.set(u, { total: 0, valor: 0 });
      const it = map.get(u)!;
      it.total += 1;
      it.valor += r.valor || 0;
      totalValor += r.valor || 0;
    });
    const porUnidade = Array.from(map.entries())
      .map(([unidade, v]) => ({ unidade, total: v.total, valor: v.valor }))
      .sort((a, b) => b.valor - a.valor);
    return { total: filteredData.length, totalValor, porUnidade };
  }, [filteredData]);

  // Chart por unidade
  const chartData = useMemo<TechnicianChartData[]>(() => {
    return kpis.porUnidade.map(u => ({
      nome: u.unidade,
      cidade: '',
      pendente: 0,
      confirmada: u.total,
      cancelada: 0,
      valor: u.valor,
    }));
  }, [kpis.porUnidade]);

  // Top 5 favorecidos por valor
  const ranking = useMemo<RankingData[]>(() => {
    const map: Record<string, { nome: string; total: number; valor: number }> = {};
    filteredData.forEach(r => {
      const k = r.favorecido || '';
      if (!k) return;
      if (!map[k]) map[k] = { nome: k, total: 0, valor: 0 };
      map[k].total += 1;
      map[k].valor += r.valor || 0;
    });
    return Object.values(map)
      .map(m => ({ nome: m.nome, totalContratos: m.total, totalValor: m.valor }))
      .sort((a, b) => b.totalValor - a.totalValor);
  }, [filteredData]);

  // "Frentes" agora = consolidado por favorecido
  const frentesData = useMemo<FrenteKPIData[]>(() => {
    const totalGeralValor = filteredData.reduce((s, r) => s + (r.valor || 0), 0);
    const map = new Map<string, { qtd: number; valor: number; unidade: string; centroCusteio: string; favorecidos: Set<string> }>();
    filteredData.forEach(r => {
      const k = r.categoria || 'Sem Categoria';
      if (!map.has(k)) map.set(k, { qtd: 0, valor: 0, unidade: r.unidade || '', centroCusteio: r.centro_custeio || '', favorecidos: new Set() });
      const it = map.get(k)!;
      it.qtd += 1;
      it.valor += r.valor || 0;
      if (r.favorecido) it.favorecidos.add(r.favorecido);
    });
    return Array.from(map.entries())
      .map(([categoria, g]) => ({
        frente: categoria,
        qtdConsultivo: g.qtd,
        totalGeral: g.qtd,
        pctConfirmada: totalGeralValor > 0 ? (g.valor / totalGeralValor) * 100 : 0,
        totalTecnicos: g.favorecidos.size,
        tecAdherente: g.favorecidos.size,
        pctTecAdherente: 100,
        tecNaoVenderam: [],
        totalValor: g.valor,
        unidade: g.unidade,
        centroCusteio: g.centroCusteio,
      }))
      .sort((a, b) => (b.totalValor || 0) - (a.totalValor || 0));
  }, [filteredData]);

  const submitManualEntry = useCallback(async (formData: Record<string, any>) => {
    const record = {
      data_lancamento: formData.data_lancamento,
      nome: formData.nome,
      chave_pix: formData.chave_pix,
      favorecido: formData.favorecido,
      descricao: formData.descricao || null,
      valor: formData.valor,
      cnpj_id: formData.cnpj_id,
      unidade_id: formData.unidade_id,
      centro_de_custo_id: formData.centro_de_custo_id,
      categoria_id: formData.categoria_id,
      secao_custeio_id: formData.secao_custeio_id,
      centro_custeio_id: formData.centro_custeio_id,
    };
    const { error: insertError } = await externalSupabase
      .from('lancamentos_pix')
      .insert([record]);
    if (insertError) throw insertError;
    await fetchData();
  }, [fetchData]);

  const updateRecord = useCallback(async (id: string, updates: Partial<LancamentoPix> & Record<string, any>) => {
    const { error: updateError } = await externalSupabase
      .from('lancamentos_pix')
      .update(updates)
      .eq('id', id);
    if (updateError) throw updateError;
    await fetchData();
  }, [fetchData]);

  const deleteRecord = useCallback(async (id: string) => {
    const { error: deleteError } = await externalSupabase
      .from('lancamentos_pix')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;
    await fetchData();
  }, [fetchData]);

  const importExcel = useCallback(async (rows: Record<string, any>[]) => {
    // Helper: resolve option name -> id, auto-creating when missing
    const resolverCache: Record<string, Map<string, string>> = {};
    const resolveOpcao = async (table: string, name: string | null): Promise<string | null> => {
      if (!name) return null;
      const key = name.toUpperCase().trim();
      if (!resolverCache[table]) {
        resolverCache[table] = new Map();
        const { data: existing } = await externalSupabase.from(table).select('id, nome');
        (existing || []).forEach((r: any) => resolverCache[table].set(String(r.nome).toUpperCase().trim(), r.id));
      }
      const cached = resolverCache[table].get(key);
      if (cached) return cached;
      const { data: inserted, error } = await externalSupabase
        .from(table)
        .insert({ nome: name })
        .select('id')
        .maybeSingle();
      if (error || !inserted) return null;
      resolverCache[table].set(key, inserted.id);
      return inserted.id;
    };

    const errors: string[] = [];
    let inserted = 0;
    let skipped = 0;
    const records: any[] = [];

    for (const r of rows) {
      if (!r.data_lancamento && r.valor == null && !r.descricao) { skipped++; continue; }
      try {
        const unidade_id = await resolveOpcao('opcoes_unidade', r.unidade_name);
        const centro_de_custo_id = await resolveOpcao('opcoes_centro_de_custo', r.centro_de_custo_name);
        const categoria_id = await resolveOpcao('opcoes_categoria', r.categoria_name);
        const cnpj_id = await resolveOpcao('opcoes_cnpj', r.cnpj_name);

        // Usa a UNIDADE também como CENTRO DE CUSTEIO
        const centro_custeio_id = await resolveOpcao('opcoes_centro_custeio', r.unidade_name);

        records.push({
          data_lancamento: r.data_lancamento,
          nome: r.descricao || r.banco || 'IMPORTADO',
          chave_pix: '',
          favorecido: r.descricao || r.banco || 'IMPORTADO',
          descricao: r.descricao,
          valor: r.valor,
          unidade_id,
          centro_de_custo_id,
          centro_custeio_id,
          categoria_id,
          cnpj_id,
          banco: r.banco,
          forma_pagamento: r.forma_pagamento,
          status_pag: r.status_pag,
        });
      } catch (e: any) {
        errors.push(e.message || 'erro linha');
      }
    }

    if (records.length > 0) {
      // Insert in chunks of 200
      for (let i = 0; i < records.length; i += 200) {
        const chunk = records.slice(i, i + 200);
        const { error: insErr } = await externalSupabase.from('lancamentos_pix').insert(chunk);
        if (insErr) errors.push(insErr.message);
        else inserted += chunk.length;
      }
    }

    await fetchData();
    return { inserted, skipped, errors };
  }, [fetchData]);



  return {
    data: filteredData,
    allData: data,
    isLoading,
    error,
    filters,
    setFilters: (f: Partial<ComissionamentoFilters>) => setFilters(prev => ({ ...prev, ...f })),
    clearFilters: () => setFilters({
      cidade: [], dataInicio: '', dataFim: '', status: [], nome: [],
      frente: [], contrato: [], dataExecInicio: '', dataExecFim: '',
      descricao: '', cnpj: [], centroCusteio: []
    }),
    fetchData,
    submitManualEntry,
    updateRecord,
    deleteRecord,
    importExcel,
    uniqueCidades,
    uniqueNomes,
    uniqueFrente,
    kpis,
    chartData,
    ranking,
    frentesData,
    opcoes,
  };
}
