import { useCallback, useEffect, useMemo, useState } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { sortUnidadesParaFiltro } from '@/lib/unidades';
import { getCombustivelImportKey, parseCombustivelDate } from '@/lib/beneficioImport';
import { sortFlashBeneficioTipos, validateFlashBeneficioTipo } from '@/lib/flashBeneficioTipos';
import type { OpcaoSelect } from '@/types/comissionamento';
import {
  BeneficioFilters,
  BeneficioImportPayload,
  BeneficioImportResult,
  BeneficioOpcoes,
  BeneficioRegistro,
  BeneficioTipo,
  FlashBeneficioTipo,
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
  tipoBeneficio: [],
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
  const [flashTipos, setFlashTipos] = useState<OpcaoSelect[]>([]);
  const [isLoadingFlashTipos, setIsLoadingFlashTipos] = useState(false);
  const [flashTiposError, setFlashTiposError] = useState<string | null>(null);
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
        unidades: sortUnidadesParaFiltro(
          ((unidadesResult.data || []) as { codigo: string; unidade: string }[])
          .map(row => ({
            id: row.codigo,
            nome: row.unidade,
            ordem: Number(row.codigo.replace(/\D/g, '')) || null,
          })),
          unidade => unidade.id,
          unidade => unidade.nome,
        ),
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

  const fetchFlashTipos = useCallback(async () => {
    if (tipo !== 'flash') return;
    setIsLoadingFlashTipos(true);
    setFlashTiposError(null);
    try {
      const { data: rows, error: fetchError } = await externalSupabase
        .from('beneficios_flash_tipos')
        .select('nome, ordem')
        .order('ordem')
        .order('nome');
      if (fetchError) throw fetchError;
      setFlashTipos(sortFlashBeneficioTipos((rows || []).map(row => ({ id: row.nome, nome: row.nome, ordem: row.ordem }))));
    } catch (err) {
      console.error('Erro ao buscar tipos de benefício Flash:', err);
      setFlashTiposError('Não foi possível carregar os tipos de benefício Flash. Clique em Atualizar para tentar novamente.');
    } finally {
      setIsLoadingFlashTipos(false);
    }
  }, [tipo]);

  const createFlashTipo = useCallback(async (value: string): Promise<string> => {
    const nome = validateFlashBeneficioTipo(value, flashTipos);
    const { data: row, error: createError } = await externalSupabase
      .from('beneficios_flash_tipos')
      .insert({ nome })
      .select('nome, ordem')
      .single();
    if (createError) {
      if (createError.code === '23505') throw new Error('Já existe um tipo de benefício com esse nome.');
      if (createError.code === '42501') throw new Error('Seu perfil não tem permissão para cadastrar tipos de benefício.');
      throw new Error(createError.message || 'Não foi possível cadastrar o tipo de benefício.');
    }
    setFlashTipos(previous => sortFlashBeneficioTipos([...previous.filter(option => option.id !== row.nome), { id: row.nome, nome: row.nome, ordem: row.ordem }]));
    return row.nome;
  }, [flashTipos]);

  useEffect(() => { fetchFlashTipos(); }, [fetchFlashTipos]);
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
    if (tipo === 'flash' && filters.tipoBeneficio.length > 0) {
      rows = rows.filter(row => filters.tipoBeneficio.includes(row.tipo_beneficio || 'Flash (legado)'));
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

  const opcoesTiposBeneficio = useMemo(() => {
    const tipos = flashTipos.map(option => option.nome);
    if (data.some(row => !row.tipo_beneficio)) tipos.push('Flash (legado)');
    return tipos.map(nome => ({ id: nome, nome }));
  }, [data, flashTipos]);

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
      const flashBeneficioTipo: FlashBeneficioTipo | null = tipo === 'flash'
        ? payload.tipo_beneficio || null
        : null;

      if (tipo === 'flash' && !flashBeneficioTipo) {
        return {
          inserted: 0,
          skipped: payload.rows.length,
          duplicateCount: 0,
          duplicateCpfs: [],
          errors: ['Selecione o tipo de benefício Flash antes de importar.'],
        };
      }
      if (tipo === 'flash' && !flashTipos.some(option => option.id === flashBeneficioTipo)) {
        return { inserted: 0, skipped: payload.rows.length, duplicateCount: 0, duplicateCpfs: [], errors: ['Selecione um tipo de benefício Flash cadastrado.'] };
      }

      const normalizedRows = payload.rows
        .map(row => ({
          cpf: normalizeCpf(row.cpf),
          placa: normalizePlaca(row.placa),
          valor: Number(row.valor) || 0,
          data_beneficio: tipo === 'combustivel' ? parseCombustivelDate(row.data_beneficio) : payload.data_beneficio,
        }))
        .filter(row => {
          if (!row.cpf || row.valor <= 0 || (tipo === 'combustivel' && (!row.placa || !row.data_beneficio))) {
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
      const existingPageSize = 1000;
      const dateChunks = tipo === 'combustivel'
        ? chunkArray(Array.from(new Set(normalizedRows.map(row => row.data_beneficio))), 100)
        : [[payload.data_beneficio]];

      for (const dates of dateChunks) {
        let existingPage = 0;
        while (true) {
          let query = externalSupabase.from(table).select(
            tipo === 'combustivel' ? 'id, cpf, placa, valor, data_beneficio'
              : tipo === 'flash' ? 'id, cpf, valor, tipo_beneficio' : 'id, cpf, valor'
          );
          query = tipo === 'combustivel'
            ? query.in('data_beneficio', dates)
            : query.eq('data_beneficio', payload.data_beneficio);
          const { data: existingRows, error: existingError } = await query
            .order('id', { ascending: true })
            .range(
              existingPage * existingPageSize,
              (existingPage + 1) * existingPageSize - 1,
            );

          if (existingError) throw existingError;

          (existingRows || []).forEach((row: any) => {
            const cpf = normalizeCpf(row.cpf);
            const valueInCents = Math.round((Number(row.valor) || 0) * 100);
            if (!cpf || valueInCents <= 0) return;

            const baseKey = `${cpf}:${valueInCents}`;
            existingKeys.add(
              tipo === 'combustivel' ? getCombustivelImportKey(row)
                : tipo === 'flash' ? `${baseKey}:${row.tipo_beneficio || '*'}` : baseKey,
            );
          });

          if (!existingRows || existingRows.length < existingPageSize) break;
          existingPage++;
        }
      }

      const uniqueRows = normalizedRows.filter(row => {
        const valueInCents = Math.round(row.valor * 100);
        const baseKey = `${row.cpf}:${valueInCents}`;
        const key = tipo === 'combustivel' ? getCombustivelImportKey(row)
          : tipo === 'flash' ? `${baseKey}:${flashBeneficioTipo}` : baseKey;
        const matchesLegacyFlash = tipo === 'flash' && existingKeys.has(`${baseKey}:*`);
        if (existingKeys.has(key) || matchesLegacyFlash) {
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
          data_beneficio: row.data_beneficio,
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
            : tipo === 'flash'
              ? { ...baseRow, tipo_beneficio: flashBeneficioTipo }
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
  }, [fetchData, tipo, flashTipos]);

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
    error: error || (tipo === 'flash' ? flashTiposError : null),
    filters,
    setFilters: (patch: Partial<BeneficioFilters>) => setFiltersState(prev => ({ ...prev, ...patch })),
    clearFilters: () => setFiltersState(getDefaultFilters()),
    fetchData,
    flashTipos,
    isLoadingFlashTipos,
    fetchFlashTipos,
    createFlashTipo,
    importExcel,
    deleteSelected,
    opcoes,
    opcoesNomes,
    opcoesTiposBeneficio,
    kpis,
  };
}
