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
  OperationalReportImportResult,
  OperationalReportImportRow,
} from '@/types/comissionamento';
import { buildMonthlyDates, clampMonthlyOccurrences } from '@/utils/monthlyDates';

interface OpcoesData {
  cnpj: OpcaoSelect[];
  unidade: OpcaoSelect[];
  centro_de_custo: OpcaoSelect[];
  categoria: OpcaoSelect[];
  secao_custeio: OpcaoSelect[];
  centro_custeio: OpcaoSelect[];
  plano_contas: OpcaoSelect[];
  bancos: OpcaoSelect[];
}

const EMPTY_OPCOES: OpcoesData = {
  cnpj: [], unidade: [], centro_de_custo: [],
  categoria: [], secao_custeio: [], centro_custeio: [],
  plano_contas: [], bancos: []
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentMonthFilters = (): Pick<ComissionamentoFilters, 'dataInicio' | 'dataFim'> => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    dataInicio: formatDateInput(firstDay),
    dataFim: formatDateInput(lastDay),
  };
};

const getDefaultFilters = (): ComissionamentoFilters => ({
  cidade: [],
  ...getCurrentMonthFilters(),
  status: [],
  nome: [],
  frente: [],
  contrato: [],
  dataExecInicio: '',
  dataExecFim: '',
  descricao: '',
  cnpj: [],
  contaAnalitica: [],
  banco: [],
});

const normalizeLancamentoPix = (row: LancamentoPix): LancamentoPix => ({
  ...row,
  unidade: row.unidade_cadastro || row.unidade,
  centro_de_custo: row.setor_nome || row.centro_de_custo,
  banco: row.banco_cadastro || row.banco,
});

const normalizeFilterValue = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const stripUnidadePrefix = (value: string) =>
  value
    .replace(/^filial\s*\d+\s*-\s*/, '')
    .replace(/^matriz\s*-\s*/, '')
    .trim();

const matchesUnidadeFilter = (row: LancamentoPix, selected: string) => {
  const unidade = normalizeFilterValue(row.unidade || '');
  const codigo = normalizeFilterValue(row.unidade_codigo || '');
  const codigoNome = codigo && unidade ? normalizeFilterValue(`${codigo} - ${row.unidade}`) : '';
  const selectedValue = normalizeFilterValue(selected);
  const unidadeSemPrefixo = stripUnidadePrefix(unidade);
  const selectedSemPrefixo = stripUnidadePrefix(selectedValue);

  return [unidade, codigo, codigoNome].some(value => value && value === selectedValue)
    || Boolean(unidadeSemPrefixo && selectedSemPrefixo && unidadeSemPrefixo === selectedSemPrefixo);
};

const stripContaAnaliticaCodigo = (value: string | null | undefined) =>
  (value || '').replace(/^\d{2}-\d{2}-\d{3}\s*-\s*/, '').trim();

const getDashboardContaLabel = (row: LancamentoPix) =>
  stripContaAnaliticaCodigo(row.conta_analitica) || 'Sem Conta Analítica';

const formatDateBR = (value: string | null | undefined) => {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const formatCurrencyBR = (value: number | null | undefined) =>
  value == null
    ? ''
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const matchesGeneralSearch = (row: LancamentoPix, query: string) => {
  const normalizedQuery = normalizeFilterValue(query);
  const queryDigits = onlyDigits(query);

  if (!normalizedQuery && !queryDigits) return true;

  const searchableValues = [
    row.data_lancamento,
    formatDateBR(row.data_lancamento),
    row.nome,
    row.favorecido,
    row.chave_pix,
    row.cnpj,
    row.unidade,
    row.unidade_cadastro,
    row.unidade_codigo,
    row.centro_de_custo,
    row.setor_nome,
    row.setor_codigo,
    row.conta_analitica,
    row.conta_analitica_codigo,
    row.conta_analitica_descricao,
    row.descricao,
    row.banco,
    row.banco_cadastro,
    row.banco_codigo,
    row.status_pag,
    row.categoria,
    row.secao_custeio,
    row.centro_custeio,
    row.parcela_numero && row.parcela_total
      ? `Parcela ${row.parcela_numero}/${row.parcela_total}`
      : null,
    row.valor,
    formatCurrencyBR(row.valor),
  ];

  const textHaystack = searchableValues
    .map(value => normalizeFilterValue(String(value ?? '')))
    .join(' ');
  const digitHaystack = searchableValues.map(onlyDigits).join(' ');

  return textHaystack.includes(normalizedQuery)
    || Boolean(queryDigits && digitHaystack.includes(queryDigits));
};

const createClientUuid = () => (
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      const value = Math.floor(Math.random() * 16);
      const next = char === 'x' ? value : (value & 0x3) | 0x8;
      return next.toString(16);
    })
);

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export function useComissionamento() {
  const [data, setData] = useState<LancamentoPix[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesData>(EMPTY_OPCOES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ComissionamentoFilters>(() => getDefaultFilters());

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
          .from('vw_lancamentos_pix_com_conta_analitica')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('data_lancamento', { ascending: false })
          .order('created_at', { ascending: true })
          .order('id', { ascending: true });

        if (fetchError) throw fetchError;
        if (rows && rows.length > 0) {
          allData = [...allData, ...rows as LancamentoPix[]];
          if (rows.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }
      setData(allData.map(normalizeLancamentoPix));
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
      { key: 'categoria', table: 'opcoes_categoria' },
      { key: 'secao_custeio', table: 'opcoes_secao_custeio' },
      { key: 'centro_custeio', table: 'opcoes_centro_custeio' },
    ];
    const next: OpcoesData = { ...EMPTY_OPCOES };

    const optionsPromise = Promise.all(tables.map(async ({ key, table }) => {
      const { data: rows, error: err } = await externalSupabase
        .from(table)
        .select('id, nome, ordem')
        .order('ordem', { ascending: true });
      if (!err && rows) next[key] = rows as OpcaoSelect[];
    }));

    const unidadesPromise = externalSupabase
      .from('unidades')
      .select('codigo, unidade')
      .eq('ativo', true);

    const setoresPromise = externalSupabase
      .from('setor')
      .select('codigo, setor')
      .eq('ativo', true);

    const bancosPromise = externalSupabase
      .from('bancos')
      .select('codigo, banco')
      .eq('ativo', true);

    const planoPromise = externalSupabase
      .from('vw_plano_contas_relatorio')
      .select('conta_id, conta_codigo, conta_descricao, conta_natureza, conta_ordem')
      .order('conta_codigo', { ascending: true });

    const [, unidadesResult, setoresResult, bancosResult, planoResult] = await Promise.all([
      optionsPromise,
      unidadesPromise,
      setoresPromise,
      bancosPromise,
      planoPromise,
    ]);

    if (!unidadesResult.error && unidadesResult.data) {
      next.unidade = (unidadesResult.data as { codigo: string; unidade: string }[])
        .map(row => ({
          id: row.codigo,
          nome: row.unidade,
          ordem: Number(row.codigo) || null,
        }))
        .sort((a, b) => a.id.localeCompare(b.id, 'pt-BR', { numeric: true }));
    }

    if (!setoresResult.error && setoresResult.data) {
      next.centro_de_custo = (setoresResult.data as { codigo: string; setor: string }[])
        .map(row => ({
          id: row.codigo,
          nome: row.setor,
          ordem: Number(row.codigo.replace(/\D/g, '')) || null,
        }))
        .sort((a, b) => a.id.localeCompare(b.id, 'pt-BR', { numeric: true }));
    }

    if (!bancosResult.error && bancosResult.data) {
      next.bancos = (bancosResult.data as { codigo: string; banco: string }[])
        .map(row => ({
          id: row.codigo,
          nome: row.banco,
          ordem: Number(row.codigo.replace(/\D/g, '')) || null,
        }))
        .sort((a, b) => a.id.localeCompare(b.id, 'pt-BR', { numeric: true }));
    }

    const { data: planoRows, error: planoErr } = planoResult;

    if (!planoErr && planoRows) {
      next.plano_contas = planoRows.map((row: any) => ({
        id: row.conta_id,
        nome: `${row.conta_codigo} - ${row.conta_descricao}`,
        natureza: row.conta_natureza || null,
        ordem: row.conta_ordem ?? null,
      }));
    }

    setOpcoes(next);
  }, []);

  useEffect(() => { fetchOpcoes(); }, [fetchOpcoes]);

  const filteredData = useMemo(() => {
    let result = [...data];

    if (filters.cidade.length > 0) {
      result = result.filter(r =>
        filters.cidade.some(c => matchesUnidadeFilter(r, c))
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
      result = result.filter(r => filters.frente.includes(getDashboardContaLabel(r)));
    }
    if (filters.contrato.length > 0) {
      result = result.filter(r =>
        filters.contrato.some(c => (r.centro_de_custo || '').toLowerCase().includes(c.toLowerCase()))
      );
    }
    if (filters.descricao && filters.descricao.trim()) {
      const q = filters.descricao.trim();
      result = result.filter(r => matchesGeneralSearch(r, q));
    }
    if (filters.contaAnalitica.length > 0) {
      result = result.filter(r => filters.contaAnalitica.includes(r.conta_analitica || ''));
    }
    if (filters.banco.length > 0) {
      result = result.filter(r => filters.banco.includes(r.banco || ''));
    }
    if (filters.status.length > 0) {
      result = result.filter(r => filters.status.includes((r.status_pag || '').toUpperCase()));
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
    () => [...new Set(data.map(getDashboardContaLabel).filter(Boolean))].sort() as string[],
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

  // Dashboard agora acompanha a DRE: agrupamento por Conta Analítica.
  const frentesData = useMemo<FrenteKPIData[]>(() => {
    const totalGeralValor = filteredData.reduce((s, r) => s + (r.valor || 0), 0);
    const map = new Map<string, { qtd: number; valor: number; unidade: string; contasAnaliticas: Set<string>; favorecidos: Set<string> }>();
    filteredData.forEach(r => {
      const k = getDashboardContaLabel(r);
      if (!map.has(k)) map.set(k, { qtd: 0, valor: 0, unidade: r.unidade || '', contasAnaliticas: new Set(), favorecidos: new Set() });
      const it = map.get(k)!;
      it.qtd += 1;
      it.valor += r.valor || 0;
      if (r.favorecido) it.favorecidos.add(r.favorecido);
      const contaLabel = stripContaAnaliticaCodigo(r.conta_analitica);
      if (contaLabel) it.contasAnaliticas.add(contaLabel);
    });
    return Array.from(map.entries())
      .map(([contaAnalitica, g]) => ({
        frente: contaAnalitica,
        qtdConsultivo: g.qtd,
        totalGeral: g.qtd,
        pctConfirmada: totalGeralValor > 0 ? (g.valor / totalGeralValor) * 100 : 0,
        totalTecnicos: g.favorecidos.size,
        tecAdherente: g.favorecidos.size,
        pctTecAdherente: 100,
        tecNaoVenderam: [],
        totalValor: g.valor,
        unidade: g.unidade,
        contasAnaliticas: Array.from(g.contasAnaliticas),
      }))
      .sort((a, b) => (b.totalValor || 0) - (a.totalValor || 0));
  }, [filteredData]);

  const submitManualEntry = useCallback(async (formData: Record<string, any>) => {
    const rateios = Array.isArray(formData.rateios) ? formData.rateios : [];
    const quantidadeDespesas = clampMonthlyOccurrences(Number(formData.quantidade_despesas) || 1);
    const datasLancamento = buildMonthlyDates(formData.data_lancamento, quantidadeDespesas);
    const buildRecord = (
      dataLancamento: string,
      rateioLoteId: string | null,
      parcelaNumero: number | null,
      rateio?: Record<string, any>,
      index?: number,
    ) => ({
      data_lancamento: dataLancamento,
      nome: formData.nome,
      chave_pix: formData.chave_pix || null,
      favorecido: formData.favorecido,
      descricao: formData.descricao || null,
      plano_conta_id: rateio?.plano_conta_id || formData.plano_conta_id,
      valor: rateio?.valor ?? formData.valor,
      cnpj_id: formData.cnpj_id || null,
      unidade_id: null,
      unidade_codigo: rateio?.unidade_id || formData.unidade_id,
      centro_de_custo_id: null,
      setor_codigo: rateio?.centro_de_custo_id || formData.centro_de_custo_id,
      categoria_id: null,
      secao_custeio_id: formData.secao_custeio_id || null,
      centro_custeio_id: formData.centro_custeio_id || null,
      banco_codigo: formData.banco_codigo || null,
      banco: formData.banco || null,
      status_pag: formData.status_pag || 'A PAGAR',
      rateio_lote_id: rateioLoteId,
      rateio_item_ordem: rateioLoteId ? (index ?? 0) + 1 : null,
      parcela_numero: parcelaNumero,
      parcela_total: parcelaNumero ? quantidadeDespesas : null,
    });
    const records = datasLancamento.flatMap((dataLancamento, parcelaIndex) => {
      const rateioLoteId = rateios.length > 0 ? createClientUuid() : null;
      const parcelaNumero = quantidadeDespesas > 1 ? parcelaIndex + 1 : null;
      return rateios.length > 0
        ? rateios.map((rateio, index) => buildRecord(dataLancamento, rateioLoteId, parcelaNumero, rateio, index))
        : [buildRecord(dataLancamento, null, parcelaNumero)];
    });
    const { error: insertError } = await externalSupabase
      .from('lancamentos_pix')
      .insert(records);
    if (insertError) throw insertError;
    await fetchData();
  }, [fetchData]);

  const updateRecord = useCallback(async (id: string, updates: Partial<LancamentoPix> & Record<string, any>) => {
    if (Array.isArray(updates.rateios) && updates.rateios.length > 0) {
      const { rateios, valor_total, ...dados } = updates;
      const { error: rateioError } = await externalSupabase.rpc('atualizar_lancamento_com_rateios', {
        p_lancamento_id: id,
        p_dados: dados,
        p_valor_total: valor_total,
        p_rateios: rateios,
      });
      if (rateioError) throw rateioError;
      await fetchData();
      return;
    }

    const { error: updateError } = await externalSupabase
      .from('lancamentos_pix')
      .update(updates)
      .eq('id', id);
    if (updateError) throw updateError;
    await fetchData();
  }, [fetchData]);

  const updateRecordsStatus = useCallback(async (ids: string[], status: string) => {
    if (ids.length === 0) return;

    const { error: updateError } = await externalSupabase
      .from('lancamentos_pix')
      .update({ status_pag: status })
      .in('id', ids);
    if (updateError) throw updateError;
    await fetchData();
  }, [fetchData]);

  const deleteRecord = useCallback(async (id: string) => {
    const { data: target, error: targetError } = await externalSupabase
      .from('lancamentos_pix')
      .select('rateio_lote_id')
      .eq('id', id)
      .maybeSingle();
    if (targetError) throw targetError;

    const deleteQuery = externalSupabase.from('lancamentos_pix').delete();
    const { error: deleteError } = target?.rateio_lote_id
      ? await deleteQuery.eq('rateio_lote_id', target.rateio_lote_id)
      : await deleteQuery.eq('id', id);
    if (deleteError) throw deleteError;
    await fetchData();
  }, [fetchData]);

  const importExcel = useCallback(async (rows: Record<string, any>[]) => {
    // Helper: resolve option name -> id, auto-creating when missing
    const resolverCache: Record<string, Map<string, string>> = {};
    let unidadesCache: Map<string, string> | null = null;
    let setoresCache: Map<string, string> | null = null;
    let bancosCache: Map<string, { codigo: string; banco: string }> | null = null;
    const normalizeLookup = (value: string) => value.toUpperCase().trim();

    const resolveOpcao = async (table: string, name: string | null): Promise<string | null> => {
      if (!name) return null;
      const key = normalizeLookup(name);
      if (!resolverCache[table]) {
        resolverCache[table] = new Map();
        const { data: existing } = await externalSupabase.from(table).select('id, nome');
        (existing || []).forEach((r: any) => resolverCache[table].set(normalizeLookup(String(r.nome)), r.id));
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

    const resolveUnidadeCodigo = async (value: string | null): Promise<string | null> => {
      if (!value) return null;
      if (!unidadesCache) {
        unidadesCache = new Map();
        const { data: existing } = await externalSupabase
          .from('unidades')
          .select('codigo, unidade')
          .eq('ativo', true);

        (existing || []).forEach((row: any) => {
          const codigo = String(row.codigo || '').trim();
          const unidade = String(row.unidade || '').trim();
          if (!codigo) return;
          unidadesCache!.set(normalizeLookup(codigo), codigo);
          unidadesCache!.set(normalizeLookup(unidade), codigo);
          unidadesCache!.set(normalizeLookup(`${codigo} - ${unidade}`), codigo);
        });
      }

      const lookup = normalizeLookup(value);
      const directMatch = unidadesCache.get(lookup);
      if (directMatch) return directMatch;

      if (lookup.length >= 3) {
        for (const [key, codigo] of unidadesCache.entries()) {
          if (key.endsWith(lookup) || key.includes(lookup)) return codigo;
        }
      }

      return null;
    };

    const resolveSetorCodigo = async (value: string | null): Promise<string | null> => {
      if (!value) return null;
      if (!setoresCache) {
        setoresCache = new Map();
        const { data: existing } = await externalSupabase
          .from('setor')
          .select('codigo, setor')
          .eq('ativo', true);

        (existing || []).forEach((row: any) => {
          const codigo = String(row.codigo || '').trim();
          const setor = String(row.setor || '').trim();
          if (!codigo) return;
          setoresCache!.set(normalizeLookup(codigo), codigo);
          setoresCache!.set(normalizeLookup(setor), codigo);
          setoresCache!.set(normalizeLookup(`${codigo} - ${setor}`), codigo);
        });
      }

      const lookup = normalizeLookup(value);
      const directMatch = setoresCache.get(lookup);
      if (directMatch) return directMatch;

      if (lookup.length >= 3) {
        for (const [key, codigo] of setoresCache.entries()) {
          if (key.endsWith(lookup) || key.includes(lookup)) return codigo;
        }
      }

      return null;
    };

    const resolveBanco = async (value: string | null): Promise<{ codigo: string | null; banco: string | null }> => {
      if (!value) return { codigo: null, banco: null };
      if (!bancosCache) {
        bancosCache = new Map();
        const { data: existing } = await externalSupabase
          .from('bancos')
          .select('codigo, banco')
          .eq('ativo', true);

        (existing || []).forEach((row: any) => {
          const codigo = String(row.codigo || '').trim();
          const banco = String(row.banco || '').trim();
          if (!codigo || !banco) return;
          const payload = { codigo, banco };
          bancosCache!.set(normalizeLookup(codigo), payload);
          bancosCache!.set(normalizeLookup(banco), payload);
          bancosCache!.set(normalizeLookup(`${codigo} - ${banco}`), payload);
        });
      }

      const lookup = normalizeLookup(value);
      const directMatch = bancosCache.get(lookup);
      if (directMatch) return directMatch;

      if (lookup.length >= 3) {
        for (const [key, banco] of bancosCache.entries()) {
          if (key.endsWith(lookup) || key.includes(lookup)) return banco;
        }
      }

      return { codigo: null, banco: value };
    };

    const errors: string[] = [];
    let inserted = 0;
    let skipped = 0;
    const records: any[] = [];

    for (const r of rows) {
      if (!r.data_lancamento && r.valor == null && !r.descricao) { skipped++; continue; }
      try {
        const unidade_codigo = await resolveUnidadeCodigo(r.unidade_name);
        const setor_codigo = await resolveSetorCodigo(r.centro_de_custo_name);
        const categoria_id = await resolveOpcao('opcoes_categoria', r.categoria_name);
        const cnpj_id = await resolveOpcao('opcoes_cnpj', r.cnpj_name);
        const bancoResolvido = await resolveBanco(r.banco);

        // Usa a UNIDADE também como CENTRO DE CUSTEIO
        const centro_custeio_id = await resolveOpcao('opcoes_centro_custeio', r.unidade_name);

        records.push({
          data_lancamento: r.data_lancamento,
          nome: r.descricao || r.banco || 'IMPORTADO',
          chave_pix: '',
          favorecido: r.descricao || r.banco || 'IMPORTADO',
          descricao: r.descricao,
          valor: r.valor,
          unidade_id: null,
          unidade_codigo,
          centro_de_custo_id: null,
          setor_codigo,
          centro_custeio_id,
          categoria_id,
          cnpj_id,
          banco_codigo: bancoResolvido.codigo,
          banco: bancoResolvido.banco,
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

  const importOperationalReport = useCallback(async (
    rows: OperationalReportImportRow[],
    planoContaId: string,
    fileName: string,
  ): Promise<OperationalReportImportResult> => {
    const errors: string[] = [];
    let inserted = 0;
    let skipped = 0;

    const normalize = (value: string) => normalizeFilterValue(value || '');
    const unitByLookup = new Map<string, string>();
    const costCenterByLookup = new Map<string, string>();

    opcoes.unidade.forEach(option => {
      unitByLookup.set(normalize(option.id), option.id);
      unitByLookup.set(normalize(option.nome), option.id);
    });
    opcoes.centro_de_custo.forEach(option => {
      costCenterByLookup.set(normalize(option.id), option.id);
      costCenterByLookup.set(normalize(option.nome), option.id);
    });

    const keys = rows.map(row => `${row.report_id}:${row.row_number}`);
    const existingKeys = new Set<string>();

    for (const keyChunk of chunkArray(keys, 500)) {
      const { data: existing, error: existingError } = await externalSupabase
        .from('lancamentos_pix')
        .select('relatorio_importacao_chave')
        .in('relatorio_importacao_chave', keyChunk);

      if (existingError) throw existingError;
      (existing || []).forEach((item: any) => {
        if (item.relatorio_importacao_chave) existingKeys.add(item.relatorio_importacao_chave);
      });
    }

    const records = rows.flatMap(row => {
      const importKey = `${row.report_id}:${row.row_number}`;
      if (existingKeys.has(importKey)) {
        skipped++;
        return [];
      }

      const unidadeCodigo = unitByLookup.get(normalize(row.unidade_codigo))
        || unitByLookup.get(normalize(row.unidade_nome));
      const setorCodigo = costCenterByLookup.get(normalize(row.setor_codigo))
        || costCenterByLookup.get(normalize(row.setor_nome));

      if (!unidadeCodigo || !setorCodigo || !row.data_lancamento || row.valor <= 0) {
        skipped++;
        if (errors.length < 8) {
          errors.push(`Linha ${row.row_number}: unidade, centro de custo, data ou valor invalido.`);
        }
        return [];
      }

      return [{
        data_lancamento: row.data_lancamento,
        nome: `RELATORIO - ${row.source_label}`,
        chave_pix: null,
        favorecido: row.source_label || 'Relatorio Operacional',
        descricao: row.descricao || `${row.source_label} - ${row.setor_nome} - ${row.unidade_nome}`,
        plano_conta_id: planoContaId,
        valor: row.valor,
        cnpj_id: null,
        unidade_id: null,
        unidade_codigo: unidadeCodigo,
        centro_de_custo_id: null,
        setor_codigo: setorCodigo,
        categoria_id: null,
        secao_custeio_id: null,
        centro_custeio_id: null,
        banco_codigo: null,
        banco: null,
        status_pag: 'PAGO',
        relatorio_origem: row.source,
        relatorio_arquivo_nome: fileName,
        relatorio_importacao_chave: importKey,
      }];
    });

    for (const recordChunk of chunkArray(records, 200)) {
      const { error: insertError } = await externalSupabase
        .from('lancamentos_pix')
        .insert(recordChunk);

      if (insertError) errors.push(insertError.message);
      else inserted += recordChunk.length;
    }

    await fetchData();
    return { inserted, skipped, errors };
  }, [fetchData, opcoes.centro_de_custo, opcoes.unidade]);



  return {
    data: filteredData,
    allData: data,
    isLoading,
    error,
    filters,
    setFilters: (f: Partial<ComissionamentoFilters>) => setFilters(prev => ({ ...prev, ...f })),
    clearFilters: () => setFilters(getDefaultFilters()),
    fetchData,
    submitManualEntry,
    updateRecord,
    updateRecordsStatus,
    deleteRecord,
    importExcel,
    importOperationalReport,
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
