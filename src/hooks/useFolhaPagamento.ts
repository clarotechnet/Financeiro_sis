import { useCallback, useEffect, useMemo, useState } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';

export interface DadoFinanceiro {
    id: string;
    data: string;
    nome: string;
    cpf: string;
    registro_id: string | null;
    setor: string | null;
    setor_codigo?: string | null;
    setor_nome?: string | null;
    unidade_codigo?: string | null;
    unidade_nome?: string | null;
    nome_registro: string | null;
    sal_folha: number;
    sal_familia: number;
    desc_inss: number;
    irrf: number;
    ferias: number;
    decimo_terceiro: number;
    periculosidade: number;
    hora_extra_50: number;
    hora_extra_60: number;
    hora_extra_70: number;
    hora_extra_100: number;
    dsr: number;
    sal_maternidade: number;
    vale_transporte: number;
    desc_plano_saude: number;
    desc_vale_alimentacao: number;
    desc_odonto: number;
    desc_faltas: number;
    desc_adiantamento: number;
    contribuicao: number;
    desc_pensao: number;
    dif_salario: number;
    emprestimo: number;
    desc_fardamento: number;
    demais_desc: number;
    total_proventos: number;
    total_descontos: number;
    salario_liquido: number;
}

// Mapa: label exibido no filtro -> coluna do banco
export const VERBA_FIELDS: { label: string; field: keyof DadoFinanceiro }[] = [
    { label: 'Férias', field: 'ferias' },
    { label: '13° Salário', field: 'decimo_terceiro' },
    { label: 'Periculosidade', field: 'periculosidade' },
    { label: 'Hora extra 50%', field: 'hora_extra_50' },
    { label: 'Hora extra 60%', field: 'hora_extra_60' },
    { label: 'Hora extra 70%', field: 'hora_extra_70' },
    { label: 'Hora extra 100%', field: 'hora_extra_100' },
    { label: 'DSR', field: 'dsr' },
    { label: 'Sal. Maternidade', field: 'sal_maternidade' },
    { label: 'Sal. Família', field: 'sal_familia' },
    { label: 'Vale transporte', field: 'vale_transporte' },
    { label: 'Desc plano saúde', field: 'desc_plano_saude' },
    { label: 'Desc vale alimentação', field: 'desc_vale_alimentacao' },
    { label: 'Desc odonto', field: 'desc_odonto' },
    { label: 'Desc faltas', field: 'desc_faltas' },
    { label: 'Desc adiantamento', field: 'desc_adiantamento' },
    { label: 'Contribuição', field: 'contribuicao' },
    { label: 'Desc Pensão', field: 'desc_pensao' },
    { label: 'Dif. Salário', field: 'dif_salario' },
    { label: 'Empréstimo', field: 'emprestimo' },
    { label: 'Desc fardamento', field: 'desc_fardamento' },
    { label: 'Demais desc', field: 'demais_desc' },
];

export interface FolhaFilters {
    dataInicio: string;
    dataFim: string;
    categoria: string[]; // setor
    verbas: string[]; // labels selecionadas em VERBA_FIELDS
    unidade: string[];   // placeholder
    nome: string[];      // placeholder
}

const EMPTY_FILTERS: FolhaFilters = {
    dataInicio: '', dataFim: '', categoria: [], verbas: [], unidade: [], nome: [],
};

const normalizeCpf = (value: string | null | undefined) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length < 11 ? digits.padStart(11, '0') : digits;
};

const chunkArray = <T,>(items: T[], size: number) => {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};

export function useFolhaPagamento() {
    const [data, setData] = useState<DadoFinanceiro[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<FolhaFilters>(EMPTY_FILTERS);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            let all: DadoFinanceiro[] = [];
            let page = 0;
            const size = 1000;
            while (true) {
                const { data: rows, error: err } = await externalSupabase
                    .from('vw_dados_financeiro')
                    .select('*')
                    .range(page * size, (page + 1) * size - 1)
                    .order('data', { ascending: false });
                if (err) throw err;
                if (!rows || rows.length === 0) break;
                all = all.concat(rows as DadoFinanceiro[]);
                if (rows.length < size) break;
                page++;
            }
            const cpfs = Array.from(new Set(all.map(row => normalizeCpf(row.cpf)).filter(Boolean)));
            const registrosByCpf = new Map<string, { unidade_codigo: string | null; setor_codigo: string | null }>();

            for (const cpfChunk of chunkArray(cpfs, 500)) {
                const { data: registros, error: registrosError } = await externalSupabase
                    .from('registros_dados')
                    .select('cpf, unidade_codigo, setor_codigo')
                    .in('cpf', cpfChunk);

                if (registrosError) throw registrosError;
                (registros || []).forEach((registro: any) => {
                    registrosByCpf.set(normalizeCpf(registro.cpf), {
                        unidade_codigo: registro.unidade_codigo || null,
                        setor_codigo: registro.setor_codigo || null,
                    });
                });
            }

            const [unidadesResult, setoresResult] = await Promise.all([
                externalSupabase.from('unidades').select('codigo, unidade'),
                externalSupabase.from('setor').select('codigo, setor'),
            ]);

            if (unidadesResult.error) throw unidadesResult.error;
            if (setoresResult.error) throw setoresResult.error;

            const unidadesByCodigo = new Map(
                (unidadesResult.data || []).map((row: any) => [String(row.codigo), String(row.unidade)]),
            );
            const setoresByCodigo = new Map(
                (setoresResult.data || []).map((row: any) => [String(row.codigo), String(row.setor)]),
            );

            setData(all.map(row => {
                const cadastro = registrosByCpf.get(normalizeCpf(row.cpf));
                const unidadeCodigo = cadastro?.unidade_codigo || row.unidade_codigo || null;
                const setorCodigo = cadastro?.setor_codigo || row.setor_codigo || null;

                return {
                    ...row,
                    unidade_codigo: unidadeCodigo,
                    unidade_nome: unidadeCodigo ? unidadesByCodigo.get(unidadeCodigo) || unidadeCodigo : null,
                    setor_codigo: setorCodigo,
                    setor_nome: setorCodigo ? setoresByCodigo.get(setorCodigo) || row.setor || setorCodigo : row.setor,
                };
            }));
        } catch (e: any) {
            console.error('Erro Folha:', e);
            setError(e.message || 'Erro ao carregar');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = useMemo(() => {
        let r = [...data];
        if (filters.dataInicio) r = r.filter(x => x.data && x.data >= filters.dataInicio);
        if (filters.dataFim) r = r.filter(x => x.data && x.data <= filters.dataFim);
        if (filters.categoria.length) r = r.filter(x => filters.categoria.includes(x.setor_nome || x.setor || ''));
        if (filters.nome.length) r = r.filter(x => filters.nome.includes(x.nome || ''));
        if (filters.verbas.length) {
            const fields = VERBA_FIELDS.filter(v => filters.verbas.includes(v.label)).map(v => v.field);
            r = r.filter(x => fields.some(f => (Number(x[f]) || 0) !== 0));
        }
        return r;
    }, [data, filters]);

    const opcoesCategoria = useMemo(
        () => [...new Set(data.map(d => d.setor_nome || d.setor).filter(Boolean))].sort((a, b) => a!.localeCompare(b!, 'pt-BR')) as string[],
        [data]
    );

    const opcoesNomes = useMemo(
        () => [...new Set(data.map(d => d.nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [data]
    );

    const kpis = useMemo(() => {
        const acc = { total: filtered.length, proventos: 0, descontos: 0, liquido: 0 };
        const map = new Map<string, { qtd: number; liquido: number; proventos: number; descontos: number }>();
        filtered.forEach(r => {
            acc.proventos += Number(r.total_proventos) || 0;
            acc.descontos += Number(r.total_descontos) || 0;
            acc.liquido += Number(r.salario_liquido) || 0;
            const k = r.setor_nome || r.setor || 'Sem Setor';
            if (!map.has(k)) map.set(k, { qtd: 0, liquido: 0, proventos: 0, descontos: 0 });
            const it = map.get(k)!;
            it.qtd += 1;
            it.liquido += Number(r.salario_liquido) || 0;
            it.proventos += Number(r.total_proventos) || 0;
            it.descontos += Number(r.total_descontos) || 0;
        });
        const porSetor = Array.from(map.entries())
            .map(([setor, v]) => ({ setor, ...v }))
            .sort((a, b) => b.liquido - a.liquido);
        return { ...acc, porSetor };
    }, [filtered]);

    const importExcel = useCallback(async (rows: Record<string, any>[]) => {
        const errors: string[] = [];
        let inserted = 0;
        let skipped = 0;
        const records = rows.filter(r => {
            if (!r.data || !r.cpf || !r.nome) { skipped++; return false; }
            return true;
        });
        for (let i = 0; i < records.length; i += 200) {
            const chunk = records.slice(i, i + 200);
            const { error: err } = await externalSupabase.from('dados_financeiro').insert(chunk);
            if (err) errors.push(err.message);
            else inserted += chunk.length;
        }
        await fetchData();
        return { inserted, skipped, errors };
    }, [fetchData]);

    return {
        data: filtered,
        allData: data,
        isLoading,
        error,
        filters,
        setFilters: (p: Partial<FolhaFilters>) => setFilters(prev => ({ ...prev, ...p })),
        clearFilters: () => setFilters(EMPTY_FILTERS),
        fetchData,
        importExcel,
        opcoesCategoria,
        opcoesNomes,
        kpis,
    };
}
