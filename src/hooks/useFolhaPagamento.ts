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
    inss: number;
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
    pro_labore: number;
    quinquenio: number;
    distribuicao_lucros: number;
    reflexo_extras_dsr: number;
    estouro_mes: number;
    diferenca_um_terco_ferias: number;
    diferenca_media_hora_ferias: number;
    horas_afast_doenca_integral: number;
    media_afast_doenca_integral: number;
    periculosidade_proporcional: number;
    inss_diferenca_ferias: number;
    inss_empregador: number;
    irrf_empregador: number;
    total_proventos: number;
    total_descontos: number;
    salario_liquido: number;
}

export interface FolhaKpiData {
    folhaTotal: number;
    receitaLiquida: number;
    folhaSobreReceita: number | null;
    encargos: number;
    salarios: number;
    encargosSobreSalarios: number | null;
    colaboradores: number;
    custoMedioColaborador: number;
    beneficios: number;
    beneficiosSobreFolha: number | null;
    evolucaoMensal: number | null;
    folhaMesAnterior: number;
    horasExtras: number;
    horasExtrasSobreFolha: number | null;
    mediaHorasExtrasColaborador: number;
    valeAlimentacao: number;
    planoSaude: number;
    premiacao: number;
    premiacaoSobreFolha: number | null;
    beneficiosPorColaborador: number;
}

export interface FolhaCentroIndicador {
    centro: string;
    valor: number;
}

export interface FolhaDespesaComposicao {
    rubrica: string;
    valor: number;
    percentual: number;
}

export interface FolhaCentroDetalhe {
    centro: string;
    colaboradores: number;
    movimentacao: number;
    receitas: number;
    despesas: number;
    resultado: number;
    variacaoResultado: number | null;
    mediaReceitasColaborador: number;
    mediaDespesasColaborador: number;
}

export interface FolhaUnidadeDetalhe {
    unidade: string;
    colaboradores: number;
    movimentacao: number;
    receitas: number;
    despesas: number;
    resultado: number;
    variacaoResultado: number | null;
    mediaReceitasColaborador: number;
    mediaDespesasColaborador: number;
    centros: FolhaCentroDetalhe[];
}

interface FolhaPagamentoFonte {
    data_lancamento: string | null;
    valor: number | null;
    unidade_codigo?: string | null;
    unidade_cadastro?: string | null;
    unidade?: string | null;
    setor_codigo?: string | null;
    setor_nome?: string | null;
    centro_de_custo?: string | null;
    conta_analitica_descricao?: string | null;
    conta_analitica?: string | null;
}

interface FolhaReceitaFonte {
    data_recebimento: string;
    valor: number | null;
    unidade_codigo: string | null;
    unidade_nome: string | null;
    setor_codigo: string | null;
    setor_nome: string | null;
    conta_natureza: string | null;
}

interface FolhaColaboradorFonte {
    cpf: string;
    nome: string;
    unidade_codigo: string | null;
    unidade_nome?: string | null;
    setor_codigo: string | null;
    setor_nome?: string | null;
}

// Mapa: label exibido no filtro -> coluna do banco
export const VERBA_FIELDS: { label: string; field: keyof DadoFinanceiro }[] = [
    { label: 'Sal. Folha', field: 'sal_folha' },
    { label: 'Pro-labore', field: 'pro_labore' },
    { label: 'Periculosidade', field: 'periculosidade' },
    { label: 'Periculosidade proporcional', field: 'periculosidade_proporcional' },
    { label: 'Hora extra 50%', field: 'hora_extra_50' },
    { label: 'Hora extra 60%', field: 'hora_extra_60' },
    { label: 'Hora extra 70%', field: 'hora_extra_70' },
    { label: 'Hora extra 100%', field: 'hora_extra_100' },
    { label: 'DSR', field: 'dsr' },
    { label: 'Reflexo extras DSR', field: 'reflexo_extras_dsr' },
    { label: 'Quinquenio', field: 'quinquenio' },
    { label: 'Distribuicao de lucros', field: 'distribuicao_lucros' },
    { label: 'Estouro do mes', field: 'estouro_mes' },
    { label: 'Diferenca de 1/3 de ferias', field: 'diferenca_um_terco_ferias' },
    { label: 'Diferenca media hora ferias', field: 'diferenca_media_hora_ferias' },
    { label: 'Horas afast. doenca', field: 'horas_afast_doenca_integral' },
    { label: 'Media afast. doenca', field: 'media_afast_doenca_integral' },
    { label: 'Ferias', field: 'ferias' },
    { label: '13o Salario', field: 'decimo_terceiro' },
    { label: 'Sal. Maternidade', field: 'sal_maternidade' },
    { label: 'Sal. Familia', field: 'sal_familia' },
    { label: 'Vale transporte', field: 'vale_transporte' },
    { label: 'Desc INSS', field: 'desc_inss' },
    { label: 'I.N.S.S.', field: 'inss' },
    { label: 'INSS diferenca ferias', field: 'inss_diferenca_ferias' },
    { label: 'INSS empregador', field: 'inss_empregador' },
    { label: 'IRRF', field: 'irrf' },
    { label: 'IRRF empregador', field: 'irrf_empregador' },
    { label: 'Desc plano saude', field: 'desc_plano_saude' },
    { label: 'Desc vale alimentacao', field: 'desc_vale_alimentacao' },
    { label: 'Desc odonto', field: 'desc_odonto' },
    { label: 'Desc faltas', field: 'desc_faltas' },
    { label: 'Desc adiantamento', field: 'desc_adiantamento' },
    { label: 'Contribuicao', field: 'contribuicao' },
    { label: 'Desc Pensao', field: 'desc_pensao' },
    { label: 'Dif. Salario', field: 'dif_salario' },
    { label: 'Emprestimo', field: 'emprestimo' },
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

const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const createDefaultFilters = (): FolhaFilters => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return {
        dataInicio: formatDateInput(firstDay),
        dataFim: formatDateInput(lastDay),
        categoria: [],
        verbas: [],
        unidade: [],
        nome: [],
    };
};

const normalizeCpf = (value: string | null | undefined) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length < 11 ? digits.padStart(11, '0') : digits;
};

const CENTROS_CUSTO_INDICADORES = [
    'T\u00e9cnico de Campo \u2014 ADS & SERVI\u00c7OS',
    'T\u00e9cnico de Campo \u2014 Desconex\u00e3o',
    'T\u00e9cnico de Campo \u2014 VT por equipe',
    'T\u00e9cnico de Campo \u2014 MDU - Manuten\u00e7\u00e3o',
    'T\u00e9cnico de Campo \u2014 MDU - Constru\u00e7\u00e3o',
    'T\u00e9cnica \u2014 Consultivo',
    'T\u00e9cnica \u2014 Gest\u00e3o',
    'Suporte de Campo \u2014 ADS & SERVI\u00c7OS',
    'Suporte de Campo \u2014 Desconex\u00e3o',
    'Suporte de Campo \u2014 VT por equipe',
    'Suporte de Campo \u2014 MDU - Manuten\u00e7\u00e3o',
    'Suporte de Campo \u2014 MDU - Constru\u00e7\u00e3o',
    'Comercial PPAP',
    'Comercial TELEMARKETING',
];

const normalizeLabel = (value: string | null | undefined) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2013\u2014-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

const isSameLabel = (left: string | null | undefined, right: string | null | undefined) =>
    normalizeLabel(left) === normalizeLabel(right);

const inDateRange = (value: string | null | undefined, start: string, end: string) =>
    Boolean(value && (!start || value >= start) && (!end || value <= end));

const shiftMonth = (value: string, amount: number) => {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    const targetMonth = month - 1 + amount;
    const lastDay = new Date(year, targetMonth + 1, 0).getDate();
    return formatDateInput(new Date(year, targetMonth, Math.min(day, lastDay)));
};

const percent = (numerator: number, denominator: number) =>
    denominator === 0 ? null : (numerator / Math.abs(denominator)) * 100;

const variation = (current: number, previous: number) =>
    previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / Math.abs(previous)) * 100;

const uniqueEmployeeKey = (row: { cpf?: string | null; nome?: string | null }) =>
    normalizeCpf(row.cpf) || normalizeLabel(row.nome);

const paymentUnit = (row: FolhaPagamentoFonte) =>
    row.unidade_cadastro || row.unidade || row.unidade_codigo || 'Sem Unidade';

const paymentSector = (row: FolhaPagamentoFonte) =>
    row.setor_nome || row.centro_de_custo || row.setor_codigo || 'Sem Centro de Custo';

const paymentAccount = (row: FolhaPagamentoFonte) =>
    row.conta_analitica_descricao
    || String(row.conta_analitica || '').replace(/^\d{2}-\d{2}-\d{3}\s*-\s*/, '')
    || 'Sem Conta Anal\u00edtica';

const receiptUnit = (row: FolhaReceitaFonte) =>
    row.unidade_nome || row.unidade_codigo || 'Sem Unidade';

const receiptSector = (row: FolhaReceitaFonte) =>
    row.setor_nome || row.setor_codigo || 'Sem Centro de Custo';

const isDeduction = (nature: string | null | undefined) =>
    normalizeLabel(nature).startsWith('DEDU');

const fetchAllRows = async <T,>(table: string, dateColumn: string): Promise<T[]> => {
    const rows: T[] = [];
    const pageSize = 1000;

    for (let page = 0; ; page += 1) {
        const { data, error } = await externalSupabase
            .from(table)
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order(dateColumn, { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data as T[]);
        if (data.length < pageSize) break;
    }

    return rows;
};

export function useFolhaPagamento() {
    const [data, setData] = useState<DadoFinanceiro[]>([]);
    const [pagamentos, setPagamentos] = useState<FolhaPagamentoFonte[]>([]);
    const [receitas, setReceitas] = useState<FolhaReceitaFonte[]>([]);
    const [cadastros, setCadastros] = useState<FolhaColaboradorFonte[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<FolhaFilters>(createDefaultFilters);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            let all: DadoFinanceiro[] = [];
            let page = 0;
            const size = 1000;
            while (true) {
                const { data: rows, error: err } = await externalSupabase
                    .from('vw_dados_financeiro_operacional')
                    .select('*')
                    .range(page * size, (page + 1) * size - 1)
                    .order('data', { ascending: false });
                if (err) throw err;
                if (!rows || rows.length === 0) break;
                all = all.concat(rows as DadoFinanceiro[]);
                if (rows.length < size) break;
                page++;
            }
            const [pagamentosRows, receitasRows, registros] = await Promise.all([
                fetchAllRows<FolhaPagamentoFonte>('vw_lancamentos_pix_com_conta_analitica', 'data_lancamento'),
                fetchAllRows<FolhaReceitaFonte>('vw_receitas_plano_contas', 'data_recebimento'),
                fetchAllRows<FolhaColaboradorFonte>('registros_dados', 'nome'),
            ]);
            const registrosByCpf = new Map<string, { unidade_codigo: string | null; setor_codigo: string | null }>();

            registros.forEach(registro => {
                registrosByCpf.set(normalizeCpf(registro.cpf), {
                    unidade_codigo: registro.unidade_codigo || null,
                    setor_codigo: registro.setor_codigo || null,
                });
            });

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
            setPagamentos(pagamentosRows);
            setReceitas(receitasRows);
            setCadastros(registros.map(registro => ({
                ...registro,
                unidade_nome: registro.unidade_codigo
                    ? unidadesByCodigo.get(registro.unidade_codigo) || registro.unidade_codigo
                    : null,
                setor_nome: registro.setor_codigo
                    ? setoresByCodigo.get(registro.setor_codigo) || registro.setor_codigo
                    : null,
            })));
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
        if (filters.unidade.length) r = r.filter(x => filters.unidade.includes(x.unidade_nome || x.unidade_codigo || ''));
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

    const opcoesUnidades = useMemo(
        () => [...new Set(data.map(d => d.unidade_nome || d.unidade_codigo).filter(Boolean))]
            .sort((a, b) => a!.localeCompare(b!, 'pt-BR')) as string[],
        [data]
    );

    const dashboard = useMemo(() => {
        const previousStart = shiftMonth(filters.dataInicio, -1);
        const previousEnd = shiftMonth(filters.dataFim, -1);
        const matchesSelected = (selected: string[], value: string) =>
            selected.length === 0 || selected.some(item => isSameLabel(item, value));
        const matchesDimensions = (unit: string, sector: string) =>
            matchesSelected(filters.unidade, unit) && matchesSelected(filters.categoria, sector);

        const previousFolha = data.filter(row => {
            const unit = row.unidade_nome || row.unidade_codigo || 'Sem Unidade';
            const sector = row.setor_nome || row.setor || 'Sem Centro de Custo';
            if (!inDateRange(row.data, previousStart, previousEnd) || !matchesDimensions(unit, sector)) return false;
            if (filters.nome.length && !filters.nome.includes(row.nome || '')) return false;
            if (filters.verbas.length) {
                const fields = VERBA_FIELDS.filter(item => filters.verbas.includes(item.label)).map(item => item.field);
                if (!fields.some(field => (Number(row[field]) || 0) !== 0)) return false;
            }
            return true;
        });

        const pagamentosAtuais = pagamentos.filter(row =>
            inDateRange(row.data_lancamento, filters.dataInicio, filters.dataFim)
            && matchesDimensions(paymentUnit(row), paymentSector(row))
        );
        const pagamentosAnteriores = pagamentos.filter(row =>
            inDateRange(row.data_lancamento, previousStart, previousEnd)
            && matchesDimensions(paymentUnit(row), paymentSector(row))
        );
        const receitasAtuais = receitas.filter(row =>
            inDateRange(row.data_recebimento, filters.dataInicio, filters.dataFim)
            && matchesDimensions(receiptUnit(row), receiptSector(row))
        );
        const receitasAnteriores = receitas.filter(row =>
            inDateRange(row.data_recebimento, previousStart, previousEnd)
            && matchesDimensions(receiptUnit(row), receiptSector(row))
        );

        const colaboradores = new Set(filtered.map(uniqueEmployeeKey).filter(Boolean)).size;
        const folhaTotal = filtered.reduce((sum, row) => sum + (Number(row.total_proventos) || 0), 0);
        const folhaMesAnterior = previousFolha.reduce((sum, row) => sum + (Number(row.total_proventos) || 0), 0);
        const salarios = filtered.reduce((sum, row) => sum + (Number(row.sal_folha) || 0), 0);
        const encargos = filtered.reduce(
            (sum, row) => sum + Math.abs(Number(row.inss_empregador) || 0) + Math.abs(Number(row.irrf_empregador) || 0),
            0,
        );
        const horasExtras = filtered.reduce(
            (sum, row) => sum
                + Math.abs(Number(row.hora_extra_50) || 0)
                + Math.abs(Number(row.hora_extra_60) || 0)
                + Math.abs(Number(row.hora_extra_70) || 0)
                + Math.abs(Number(row.hora_extra_100) || 0),
            0,
        );
        const receitaLiquida = receitasAtuais.reduce(
            (sum, row) => sum + (isDeduction(row.conta_natureza) ? -Math.abs(Number(row.valor) || 0) : Math.abs(Number(row.valor) || 0)),
            0,
        );

        let valeAlimentacao = 0;
        let planoSaude = 0;
        let premiacao = 0;
        pagamentosAtuais.forEach(row => {
            const account = normalizeLabel(paymentAccount(row));
            const value = Math.abs(Number(row.valor) || 0);
            if (account === 'ALIMENTACAO' || account === 'VALE ALIMENTACAO') valeAlimentacao += value;
            if (account === 'PLANO DE SAUDE') planoSaude += value;
            if (account === 'PREMIACAO') premiacao += value;
        });
        const beneficios = valeAlimentacao + planoSaude + premiacao;

        const kpis: FolhaKpiData = {
            folhaTotal,
            receitaLiquida,
            folhaSobreReceita: percent(folhaTotal, receitaLiquida),
            encargos,
            salarios,
            encargosSobreSalarios: percent(encargos, salarios),
            colaboradores,
            custoMedioColaborador: colaboradores ? folhaTotal / colaboradores : 0,
            beneficios,
            beneficiosSobreFolha: percent(beneficios, folhaTotal),
            evolucaoMensal: variation(folhaTotal, folhaMesAnterior),
            folhaMesAnterior,
            horasExtras,
            horasExtrasSobreFolha: percent(horasExtras, folhaTotal),
            mediaHorasExtrasColaborador: colaboradores ? horasExtras / colaboradores : 0,
            valeAlimentacao,
            planoSaude,
            premiacao,
            premiacaoSobreFolha: percent(premiacao, folhaTotal),
            beneficiosPorColaborador: colaboradores ? beneficios / colaboradores : 0,
        };

        const despesasPorRubrica = new Map<string, number>();
        const despesasPorCentro = new Map<string, number>();
        pagamentosAtuais.forEach(row => {
            const rubrica = paymentAccount(row);
            const valor = Math.abs(Number(row.valor) || 0);
            despesasPorRubrica.set(rubrica, (despesasPorRubrica.get(rubrica) || 0) + valor);
            const centroKey = normalizeLabel(paymentSector(row));
            despesasPorCentro.set(centroKey, (despesasPorCentro.get(centroKey) || 0) + valor);
        });
        const totalDespesas = Array.from(despesasPorRubrica.values()).reduce((sum, value) => sum + value, 0);
        const composicaoDespesas: FolhaDespesaComposicao[] = Array.from(despesasPorRubrica.entries())
            .map(([rubrica, valor]) => ({
                rubrica,
                valor,
                percentual: totalDespesas ? (valor / totalDespesas) * 100 : 0,
            }))
            .sort((a, b) => b.valor - a.valor);
        const centrosCusto: FolhaCentroIndicador[] = CENTROS_CUSTO_INDICADORES.map(centro => ({
            centro,
            valor: despesasPorCentro.get(normalizeLabel(centro)) || 0,
        }));

        type DetailBucket = {
            unidade: string;
            centro: string;
            colaboradores: Set<string>;
            receitas: number;
            despesas: number;
        };
        const currentBuckets = new Map<string, DetailBucket>();
        const previousResults = new Map<string, number>();
        const previousUnitResults = new Map<string, number>();
        const bucketKey = (unit: string, sector: string) => `${normalizeLabel(unit)}::${normalizeLabel(sector)}`;
        const getCurrentBucket = (unit: string, sector: string) => {
            const key = bucketKey(unit, sector);
            if (!currentBuckets.has(key)) {
                currentBuckets.set(key, { unidade: unit, centro: sector, colaboradores: new Set(), receitas: 0, despesas: 0 });
            }
            return currentBuckets.get(key)!;
        };

        cadastros.forEach(row => {
            const unit = row.unidade_nome || row.unidade_codigo || 'Sem Unidade';
            const sector = row.setor_nome || row.setor_codigo || 'Sem Centro de Custo';
            if (!matchesDimensions(unit, sector)) return;
            if (filters.nome.length && !filters.nome.includes(row.nome || '')) return;
            getCurrentBucket(unit, sector).colaboradores.add(uniqueEmployeeKey(row));
        });
        pagamentosAtuais.forEach(row => {
            getCurrentBucket(paymentUnit(row), paymentSector(row)).despesas += Math.abs(Number(row.valor) || 0);
        });
        receitasAtuais.forEach(row => {
            const signedValue = isDeduction(row.conta_natureza) ? -Math.abs(Number(row.valor) || 0) : Math.abs(Number(row.valor) || 0);
            getCurrentBucket(receiptUnit(row), receiptSector(row)).receitas += signedValue;
        });
        const addPreviousResult = (unit: string, sector: string, value: number) => {
            const key = bucketKey(unit, sector);
            previousResults.set(key, (previousResults.get(key) || 0) + value);
            const unitKey = normalizeLabel(unit);
            previousUnitResults.set(unitKey, (previousUnitResults.get(unitKey) || 0) + value);
        };
        pagamentosAnteriores.forEach(row => {
            addPreviousResult(paymentUnit(row), paymentSector(row), -Math.abs(Number(row.valor) || 0));
        });
        receitasAnteriores.forEach(row => {
            const value = isDeduction(row.conta_natureza) ? -Math.abs(Number(row.valor) || 0) : Math.abs(Number(row.valor) || 0);
            addPreviousResult(receiptUnit(row), receiptSector(row), value);
        });

        const units = new Map<string, { unidade: string; centros: FolhaCentroDetalhe[]; colaboradores: Set<string> }>();
        currentBuckets.forEach((bucket, key) => {
            const colaboradoresCentro = bucket.colaboradores.size;
            const resultado = bucket.receitas - bucket.despesas;
            const detalhe: FolhaCentroDetalhe = {
                centro: bucket.centro,
                colaboradores: colaboradoresCentro,
                movimentacao: Math.abs(bucket.receitas) + bucket.despesas,
                receitas: bucket.receitas,
                despesas: bucket.despesas,
                resultado,
                variacaoResultado: variation(resultado, previousResults.get(key) || 0),
                mediaReceitasColaborador: colaboradoresCentro ? bucket.receitas / colaboradoresCentro : 0,
                mediaDespesasColaborador: colaboradoresCentro ? bucket.despesas / colaboradoresCentro : 0,
            };
            const unitKey = normalizeLabel(bucket.unidade);
            if (!units.has(unitKey)) units.set(unitKey, { unidade: bucket.unidade, centros: [], colaboradores: new Set() });
            const unit = units.get(unitKey)!;
            unit.centros.push(detalhe);
            bucket.colaboradores.forEach(employee => unit.colaboradores.add(employee));
        });
        const unidadesDetalhe: FolhaUnidadeDetalhe[] = Array.from(units.entries())
            .map(([unitKey, unit]) => {
                const receitasUnidade = unit.centros.reduce((sum, center) => sum + center.receitas, 0);
                const despesasUnidade = unit.centros.reduce((sum, center) => sum + center.despesas, 0);
                const resultadoUnidade = receitasUnidade - despesasUnidade;
                const colaboradoresUnidade = unit.colaboradores.size;
                return {
                    unidade: unit.unidade,
                    colaboradores: colaboradoresUnidade,
                    movimentacao: Math.abs(receitasUnidade) + despesasUnidade,
                    receitas: receitasUnidade,
                    despesas: despesasUnidade,
                    resultado: resultadoUnidade,
                    variacaoResultado: variation(resultadoUnidade, previousUnitResults.get(unitKey) || 0),
                    mediaReceitasColaborador: colaboradoresUnidade ? receitasUnidade / colaboradoresUnidade : 0,
                    mediaDespesasColaborador: colaboradoresUnidade ? despesasUnidade / colaboradoresUnidade : 0,
                    centros: unit.centros.sort((a, b) => a.centro.localeCompare(b.centro, 'pt-BR')),
                };
            })
            .sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR'));

        return { kpis, centrosCusto, composicaoDespesas, unidadesDetalhe };
    }, [cadastros, data, filtered, filters, pagamentos, receitas]);

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
        clearFilters: () => setFilters(createDefaultFilters()),
        fetchData,
        importExcel,
        opcoesCategoria,
        opcoesNomes,
        opcoesUnidades,
        kpis: dashboard.kpis,
        centrosCusto: dashboard.centrosCusto,
        composicaoDespesas: dashboard.composicaoDespesas,
        unidadesDetalhe: dashboard.unidadesDetalhe,
    };
}
