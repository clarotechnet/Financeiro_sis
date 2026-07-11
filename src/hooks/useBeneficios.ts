import { useCallback, useEffect, useMemo, useState } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import {
  BeneficioFilters,
  BeneficioImportPayload,
  BeneficioImportResult,
  BeneficioOpcoes,
  BeneficioRegistro,
  BeneficioTipo,
} from '@/types/beneficios';

const TABLE_BY_TIPO: Record<BeneficioTipo, string> = {
  combustivel: 'beneficios_combustivel',
  agregamento: 'beneficios_agregamento',
};

const EMPTY_OPCOES: BeneficioOpcoes = {
  unidades: [],
  setores: [],
  contas: [],
};

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentMonthFilters = (): Pick<BeneficioFilters, 'dataInicio' | 'dataFim'> => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    dataInicio: formatDateInput(firstDay),
    dataFim: formatDateInput(lastDay),
  };
};


const getDefaultFilters = (): BeneficioFilters => ({
  ...getCurrentMonthFilters(),
  unidade: [],
  setor: [],
  contaAnalitica: [],
  busca: '',
});

const normalizeCpf = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length < 11 ? digits.padStart(11, '0') : digits;
};

const normalizePlaca = (value: string | null | undefined) =>
  String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

export function useBeneficios(tipo: BeneficioTipo) {
  const [data, setData] = useState<BeneficioRegistro[]>([]);
  const [opcoes, setOpcoes] = useState<BeneficioOpcoes>(EMPTY_OPCOES);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<BeneficioFilters>(() => getDefaultFilters());

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let all: BeneficioRegistro[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const { data: rows, error: fetchError } = await externalSupabase
          .from('vw_beneficios_plano_contas')
          .select('*')
          .eq('tipo', tipo)
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('data_beneficio', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true });

        if (fetchError) throw fetchError;
        if (!rows || rows.length === 0) break;

        all = all.concat(rows as BeneficioRegistro[]);
        if (rows.length < pageSize) break;
        page++;
      }

      setData(all);
    } catch (err: any) {
      console.error('Erro ao buscar beneficios:', err);
      setError(err.message || 'Erro ao carregar beneficios');
    } finally {
      setIsLoading(false);
    }
  }, [tipo]);

  const fetchOpcoes = useCallback(async () => {
    try {
      const [unidadesResult, setoresResult, contasResult] = await Promise.all([
        externalSupabase
          .from('unidades')
          .select('codigo, unidade')
          .eq('ativo', true),
        externalSupabase
          .from('setor')
          .select('codigo, setor')
          .eq('ativo', true),
        externalSupabase
          .from('vw_plano_contas_relatorio')
          .select('conta_id, conta_codigo, conta_descricao, conta_natureza, conta_ordem')
          .in('conta_natureza', ['Custo', 'Despesa'])
          .order('conta_codigo', { ascending: true }),
      ]);

      if (unidadesResult.error) throw unidadesResult.error;
      if (setoresResult.error) throw setoresResult.error;
      if (contasResult.error) throw contasResult.error;

      setOpcoes({
        unidades: ((unidadesResult.data || []) as { codigo: string; unidade: string }[])
          .map(row => ({
            id: row.codigo,
            nome: row.unidade,
            ordem: Number(row.codigo.replace(/\D/g, '')) || null,
          }))
          .sort((a, b) => a.id.localeCompare(b.id, 'pt-BR', { numeric: true })),
        setores: ((setoresResult.data || []) as { codigo: string; setor: string }[])
          .map(row => ({
            id: row.codigo,
            nome: row.setor,
            ordem: Number(row.codigo.replace(/\D/g, '')) || null,
          }))
          .sort((a, b) => a.id.localeCompare(b.id, 'pt-BR', { numeric: true })),
        contas: ((contasResult.data || []) as {
          conta_id: string;
          conta_codigo: string;
          conta_descricao: string;
          conta_natureza: string | null;
          conta_ordem: number | null;
        }[]).map(row => ({
          id: row.conta_id,
          nome: `${row.conta_codigo} - ${row.conta_descricao}`,
          natureza: row.conta_natureza,
          ordem: row.conta_ordem ?? null,
        })),
      });
    } catch (err) {
      console.error('Erro ao buscar opcoes de beneficios:', err);
    }
  }, []);

  useEffect(() => { fetchOpcoes(); }, [fetchOpcoes]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = useMemo(() => {
    let rows = [...data];

    if (filters.dataInicio) {
      rows = rows.filter(row => row.data_beneficio && row.data_beneficio >= filters.dataInicio);
    }
    if (filters.dataFim) {
      rows = rows.filter(row => row.data_beneficio && row.data_beneficio <= filters.dataFim);
    }
    if (filters.unidade.length > 0) {
      rows = rows.filter(row => row.unidade_codigo && filters.unidade.includes(row.unidade_codigo));
    }
    if (filters.setor.length > 0) {
      rows = rows.filter(row => row.setor_codigo && filters.setor.includes(row.setor_codigo));
    }
    if (filters.contaAnalitica.length > 0) {
      rows = rows.filter(row => filters.contaAnalitica.includes(row.plano_conta_id));
    }
    if (filters.busca.trim()) {
      const q = filters.busca.trim().toLowerCase();
      rows = rows.filter(row =>
        row.nome.toLowerCase().includes(q) ||
        row.cpf.includes(q.replace(/\D/g, '')) ||
        (tipo === 'combustivel' && row.placa?.toLowerCase().includes(q))
      );
    }

    return rows;
  }, [data, filters, tipo]);

  const kpis = useMemo(() => ({
    totalRegistros: filteredData.length,
    totalValor: filteredData.reduce((sum, row) => sum + (Number(row.valor) || 0), 0),
    colaboradores: new Set(filteredData.map(row => row.cpf)).size,
  }), [filteredData]);

  const importExcel = useCallback(async (payload: BeneficioImportPayload): Promise<BeneficioImportResult> => {
    setIsImporting(true);
    const errors: string[] = [];
    let skipped = 0;
    let inserted = 0;

    try {
      const normalizedRows = payload.rows
        .map(row => ({
          cpf: normalizeCpf(row.cpf),
          placa: normalizePlaca(row.placa),
          valor: Number(row.valor) || 0,
        }))
        .filter(row => {
          if (!row.cpf || row.valor <= 0 || (tipo === 'combustivel' && !row.placa)) {
            skipped++;
            return false;
          }
          return true;
        });

      if (normalizedRows.length === 0) {
        return { inserted: 0, skipped, errors: ['Nenhuma linha valida para importar.'] };
      }

      const cpfs = Array.from(new Set(normalizedRows.map(row => row.cpf)));
      const registros = new Map<string, {
        cpf: string;
        nome: string;
        unidade_codigo: string | null;
        setor_codigo: string | null;
      }>();

      for (const chunk of chunkArray(cpfs, 500)) {
        const { data: rows, error: fetchError } = await externalSupabase
          .from('registros_dados')
          .select('cpf, nome, unidade_codigo, setor_codigo')
          .in('cpf', chunk);

        if (fetchError) throw fetchError;
        (rows || []).forEach((row: any) => {
          const cpf = normalizeCpf(row.cpf);
          if (cpf) registros.set(cpf, {
            cpf,
            nome: row.nome,
            unidade_codigo: row.unidade_codigo || null,
            setor_codigo: row.setor_codigo || null,
          });
        });
      }

      const insertRows = normalizedRows.flatMap(row => {
        const registro = registros.get(row.cpf);
        if (!registro) {
          skipped++;
          if (errors.length < 8) errors.push(`CPF ${row.cpf} nao encontrado em registros_dados.`);
          return [];
        }

        const baseRow = {
          data_beneficio: payload.data_beneficio,
          cpf: registro.cpf,
          nome: registro.nome,
          unidade_codigo: registro.unidade_codigo,
          setor_codigo: registro.setor_codigo,
          plano_conta_id: payload.plano_conta_id,
          valor: row.valor,
          arquivo_nome: payload.arquivo_nome || null,
        };

        return [
          tipo === 'combustivel'
            ? { ...baseRow, placa: row.placa }
            : baseRow,
        ];
      });

      const table = TABLE_BY_TIPO[tipo];
      for (const chunk of chunkArray(insertRows, 200)) {
        const { error: insertError } = await externalSupabase
          .from(table)
          .insert(chunk);

        if (insertError) errors.push(insertError.message);
        else inserted += chunk.length;
      }

      await fetchData();
      return { inserted, skipped, errors };
    } catch (err: any) {
      return { inserted, skipped, errors: [err.message || 'Erro ao importar beneficios.'] };
    } finally {
      setIsImporting(false);
    }
  }, [fetchData, tipo]);

  return {
    data: filteredData,
    allData: data,
    isLoading,
    isImporting,
    error,
    filters,
    setFilters: (patch: Partial<BeneficioFilters>) => setFiltersState(prev => ({ ...prev, ...patch })),
    clearFilters: () => setFiltersState(getDefaultFilters()),
    fetchData,
    importExcel,
    opcoes,
    kpis,
  };
}
