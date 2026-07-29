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
  flash: 'beneficios_flash',
};

const EMPTY_OPCOES: BeneficioOpcoes = {
  unidades: [],
  setores: [],
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
  nome: [],
  placa: '',
  busca: '',
});

const normalizeCpf = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length < 11 ? digits.padStart(11, '0') : digits;
};

const normalizePlaca = (value: string | null | undefined) =>
  String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

const normalizePlacaSearch = (value: string | null | undefined) =>
  String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

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
  const [isDeleting, setIsDeleting] = useState(false);
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
      const [unidadesResult, setoresResult] = await Promise.all([
        externalSupabase
          .from('unidades')
          .select('codigo, unidade')
          .eq('ativo', true),
        externalSupabase
          .from('setor')
          .select('codigo, setor')
          .eq('ativo', true),
      ]);

      if (unidadesResult.error) throw unidadesResult.error;
      if (setoresResult.error) throw setoresResult.error;

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
    if ((tipo === 'flash' || tipo === 'agregamento') && filters.nome.length > 0) {
      rows = rows.filter(row => filters.nome.includes(row.nome));
    }
    if (tipo === 'combustivel' && filters.placa.trim()) {
      const placa = normalizePlacaSearch(filters.placa);
      rows = rows.filter(row => normalizePlacaSearch(row.placa).includes(placa));
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

  const opcoesNomes = useMemo(() => (
    Array.from(new Set(data.map(row => row.nome.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map(nome => ({ id: nome, nome }))
  ), [data]);

  const kpis = useMemo(() => ({
    totalRegistros: filteredData.length,
    totalValor: filteredData.reduce((sum, row) => sum + (Number(row.valor) || 0), 0),
    colaboradores: new Set(filteredData.map(row => row.cpf)).size,
  }), [filteredData]);

  const importExcel = useCallback(async (payload: BeneficioImportPayload): Promise<BeneficioImportResult> => {
    setIsImporting(true);
    const errors: string[] = [];
    const duplicateCpfs = new Set<string>();
    let duplicateCount = 0;
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
        return {
          inserted: 0,
          skipped,
          duplicateCount,
          duplicateCpfs: [],
          errors: ['Nenhuma linha valida para importar.'],
        };
      }

      const table = TABLE_BY_TIPO[tipo];
      const existingKeys = new Set<string>();
      let existingPage = 0;
      const existingPageSize = 1000;

      while (true) {
        const { data: existingRows, error: existingError } = await externalSupabase
          .from(table)
          .select('id, cpf, valor')
          .eq('data_beneficio', payload.data_beneficio)
          .order('id', { ascending: true })
          .range(
            existingPage * existingPageSize,
            (existingPage + 1) * existingPageSize - 1,
          );

        if (existingError) throw existingError;

        (existingRows || []).forEach((row: any) => {
          const cpf = normalizeCpf(row.cpf);
          const valueInCents = Math.round((Number(row.valor) || 0) * 100);
          if (cpf && valueInCents > 0) existingKeys.add(`${cpf}:${valueInCents}`);
        });

        if (!existingRows || existingRows.length < existingPageSize) break;
        existingPage++;
      }

      const uniqueRows = normalizedRows.filter(row => {
        const valueInCents = Math.round(row.valor * 100);
        const key = `${row.cpf}:${valueInCents}`;
        if (existingKeys.has(key)) {
          duplicateCount++;
          skipped++;
          duplicateCpfs.add(row.cpf);
          return false;
        }

        existingKeys.add(key);
        row.valor = valueInCents / 100;
        return true;
      });

      if (uniqueRows.length === 0) {
        return {
          inserted,
          skipped,
          duplicateCount,
          duplicateCpfs: Array.from(duplicateCpfs),
          errors,
        };
      }

      const cpfs = Array.from(new Set(uniqueRows.map(row => row.cpf)));
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

      const insertRows = uniqueRows.flatMap(row => {
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
          valor: row.valor,
          arquivo_nome: payload.arquivo_nome || null,
        };

        return [
          tipo === 'combustivel'
            ? { ...baseRow, placa: row.placa }
            : baseRow,
        ];
      });

      for (const chunk of chunkArray(insertRows, 200)) {
        const { error: insertError } = await externalSupabase
          .from(table)
          .insert(chunk);

        if (insertError) errors.push(insertError.message);
        else inserted += chunk.length;
      }

      await fetchData();
      return {
        inserted,
        skipped,
        duplicateCount,
        duplicateCpfs: Array.from(duplicateCpfs),
        errors,
      };
    } catch (err: any) {
      return {
        inserted,
        skipped,
        duplicateCount,
        duplicateCpfs: Array.from(duplicateCpfs),
        errors: [err.message || 'Erro ao importar beneficios.'],
      };
    } finally {
      setIsImporting(false);
    }
  }, [fetchData, tipo]);

  const deleteSelected = useCallback(async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return 0;

    setIsDeleting(true);
    let deleted = 0;
    try {
      const table = TABLE_BY_TIPO[tipo];
      for (const chunk of chunkArray(uniqueIds, 200)) {
        const { data: deletedRows, error: deleteError } = await externalSupabase
          .from(table)
          .delete()
          .in('id', chunk)
          .select('id');

        if (deleteError) throw deleteError;
        deleted += deletedRows?.length || 0;
      }

      return deleted;
    } finally {
      await fetchData();
      setIsDeleting(false);
    }
  }, [fetchData, tipo]);

  return {
    data: filteredData,
    allData: data,
    isLoading,
    isImporting,
    isDeleting,
    error,
    filters,
    setFilters: (patch: Partial<BeneficioFilters>) => setFiltersState(prev => ({ ...prev, ...patch })),
    clearFilters: () => setFiltersState(getDefaultFilters()),
    fetchData,
    importExcel,
    deleteSelected,
    opcoes,
    opcoesNomes,
    kpis,
  };
}
