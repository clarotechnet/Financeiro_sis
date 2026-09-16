import { useCallback, useEffect, useState } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';

export type MonitoramentoSource = 'folha' | 'combustivel' | 'agregamento' | 'flash' | 'pagamento_direto';

export interface MonitoramentoMonth {
  key: string;
  label: string;
  fullLabel: string;
  isCurrent: boolean;
}

export interface MonitoramentoBreakdown {
  folha: number;
  combustivel: number;
  agregamento: number;
  flash: number;
  pagamento_direto: number;
  total: number;
}

export interface MonitoramentoVariation {
  percent: number | null;
  kind: 'up' | 'down' | 'stable' | 'new' | 'none';
  isLarge: boolean;
}

export interface MonitoramentoEmployee {
  cpf: string;
  nome: string;
  unidadeCodigo: string | null;
  unidadeNome: string;
  setorCodigo: string | null;
  setorNome: string;
  months: Record<string, MonitoramentoBreakdown>;
  variations: MonitoramentoVariation[];
  total: number;
  hasLargeVariation: boolean;
  movements: number;
}

interface PayrollRow {
  id: string;
  data: string;
  cpf: string | null;
  nome: string | null;
  nome_registro: string | null;
  unidade_codigo: string | null;
  unidade_nome: string | null;
  setor_codigo: string | null;
  setor_nome: string | null;
  setor: string | null;
  salario_liquido: number | string | null;
}

interface BenefitRow {
  id: string;
  tipo: string;
  data_beneficio: string;
  cpf: string | null;
  nome: string | null;
  unidade_codigo: string | null;
  unidade_nome: string | null;
  setor_codigo: string | null;
  setor_nome: string | null;
  valor: number | string | null;
}

interface PaymentRow {
  id: string;
  data_lancamento: string;
  chave_pix: string | null;
  favorecido: string | null;
  descricao: string | null;
  valor: number | string | null;
  unidade_codigo: string | null;
  setor_codigo: string | null;
}

interface RegistrationRow {
  cpf: string | null;
  nome: string | null;
  unidade_codigo: string | null;
  setor_codigo: string | null;
  setor: string | null;
}

interface EmployeeAccumulator {
  cpf: string;
  nome: string;
  unidadeCodigo: string | null;
  unidadeNome: string;
  setorCodigo: string | null;
  setorNome: string;
  latestMetadataDate: string;
  months: Record<string, MonitoramentoBreakdown>;
  total: number;
  movements: number;
}

const PAGE_SIZE = 1000;
export const LARGE_VARIATION_THRESHOLD = 30;

const normalizeCpf = (value: string | null | undefined) => String(value || '').replace(/\D/g, '');

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);

const createPeriod = () => {
  const now = new Date();
  const months: MonitoramentoMonth[] = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (2 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const shortLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
      .format(date)
      .replace('.', '');
    const fullLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);

    return {
      key,
      label: capitalize(shortLabel),
      fullLabel: capitalize(fullLabel),
      isCurrent: index === 2,
    };
  });

  return {
    months,
    startDate: `${months[0].key}-01`,
    endDate: formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const emptyBreakdown = (): MonitoramentoBreakdown => ({
  folha: 0,
  combustivel: 0,
  agregamento: 0,
  flash: 0,
  pagamento_direto: 0,
  total: 0,
});

const calculateVariation = (previous: number, current: number): MonitoramentoVariation => {
  if (previous === 0 && current === 0) return { percent: null, kind: 'none', isLarge: false };
  if (previous === 0 && current > 0) return { percent: null, kind: 'new', isLarge: false };

  const percent = ((current - previous) / Math.abs(previous)) * 100;
  return {
    percent,
    kind: Math.abs(percent) < 0.01 ? 'stable' : percent > 0 ? 'up' : 'down',
    isLarge: Math.abs(percent) >= LARGE_VARIATION_THRESHOLD,
  };
};

type PageResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

const fetchAllPages = async <T,>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
) => {
  const allRows: T[] = [];

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || 'Erro ao carregar dados de monitoramento.');

    const rows = data || [];
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  return allRows;
};

const getBenefitSource = (tipo: string): MonitoramentoSource | null => {
  const normalized = tipo.trim().toLocaleLowerCase('pt-BR');
  if (normalized === 'combustivel') return 'combustivel';
  if (normalized === 'agregamento') return 'agregamento';
  if (normalized === 'flash') return 'flash';
  return null;
};

export function useMonitoramentoColaboradores() {
  const [{ months, startDate, endDate }] = useState(createPeriod);
  const [employees, setEmployees] = useState<MonitoramentoEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [payrollRows, benefitRows, paymentRows, registrations, unidadesResult, setoresResult] = await Promise.all([
        fetchAllPages<PayrollRow>((from, to) => externalSupabase
          .from('vw_dados_financeiro_operacional')
          .select('id,data,cpf,nome,nome_registro,unidade_codigo,unidade_nome,setor_codigo,setor_nome,setor,salario_liquido')
          .gte('data', startDate)
          .lte('data', endDate)
          .order('data', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)),
        fetchAllPages<BenefitRow>((from, to) => externalSupabase
          .from('vw_beneficios_plano_contas')
          .select('id,tipo,data_beneficio,cpf,nome,unidade_codigo,unidade_nome,setor_codigo,setor_nome,valor')
          .gte('data_beneficio', startDate)
          .lte('data_beneficio', endDate)
          .order('data_beneficio', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)),
        fetchAllPages<PaymentRow>((from, to) => externalSupabase
          .from('lancamentos_pix')
          .select('id,data_lancamento,chave_pix,favorecido,descricao,valor,unidade_codigo,setor_codigo')
          .gte('data_lancamento', startDate)
          .lte('data_lancamento', endDate)
          .eq('status_pag', 'PAGO')
          .is('relatorio_origem', null)
          .order('data_lancamento', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)),
        fetchAllPages<RegistrationRow>((from, to) => externalSupabase
          .from('registros_dados')
          .select('cpf,nome,unidade_codigo,setor_codigo,setor')
          .order('id', { ascending: true })
          .range(from, to)),
        externalSupabase.from('unidades').select('codigo,unidade').eq('ativo', true),
        externalSupabase.from('setor').select('codigo,setor').eq('ativo', true),
      ]);

      if (unidadesResult.error) throw unidadesResult.error;
      if (setoresResult.error) throw setoresResult.error;

      const unidades = new Map(
        ((unidadesResult.data || []) as { codigo: string; unidade: string }[])
          .map(row => [row.codigo, row.unidade]),
      );
      const setores = new Map(
        ((setoresResult.data || []) as { codigo: string; setor: string }[])
          .map(row => [row.codigo, row.setor]),
      );
      const registrationByCpf = new Map<string, RegistrationRow>();

      registrations.forEach(row => {
        const cpf = normalizeCpf(row.cpf);
        if (cpf.length === 11) registrationByCpf.set(cpf, row);
      });

      const employeeByCpf = new Map<string, EmployeeAccumulator>();
      const seenEvents = new Set<string>();

      const ensureEmployee = (
        cpf: string,
        date: string,
        fallback: {
          nome?: string | null;
          unidadeCodigo?: string | null;
          unidadeNome?: string | null;
          setorCodigo?: string | null;
          setorNome?: string | null;
        },
      ) => {
        const registration = registrationByCpf.get(cpf);
        const registrationUnitName = registration?.unidade_codigo
          ? unidades.get(registration.unidade_codigo)
          : null;
        const registrationSectorName = registration?.setor_codigo
          ? setores.get(registration.setor_codigo)
          : null;
        let employee = employeeByCpf.get(cpf);

        if (!employee) {
          employee = {
            cpf,
            nome: registration?.nome?.trim() || fallback.nome?.trim() || 'Colaborador sem nome',
            unidadeCodigo: registration?.unidade_codigo || fallback.unidadeCodigo || null,
            unidadeNome: registrationUnitName || fallback.unidadeNome?.trim() || 'Sem unidade',
            setorCodigo: registration?.setor_codigo || fallback.setorCodigo || null,
            setorNome: registrationSectorName || registration?.setor?.trim() || fallback.setorNome?.trim() || 'Sem setor',
            latestMetadataDate: date,
            months: Object.fromEntries(months.map(month => [month.key, emptyBreakdown()])),
            total: 0,
            movements: 0,
          };
          employeeByCpf.set(cpf, employee);
        } else if (!registration && date >= employee.latestMetadataDate) {
          employee.nome = fallback.nome?.trim() || employee.nome;
          employee.unidadeCodigo = fallback.unidadeCodigo || employee.unidadeCodigo;
          employee.unidadeNome = fallback.unidadeNome?.trim() || employee.unidadeNome;
          employee.setorCodigo = fallback.setorCodigo || employee.setorCodigo;
          employee.setorNome = fallback.setorNome?.trim() || employee.setorNome;
          employee.latestMetadataDate = date;
        }

        return employee;
      };

      const addEvent = (
        eventKey: string,
        cpfValue: string | null,
        date: string,
        source: MonitoramentoSource,
        rawValue: number | string | null,
        metadata: Parameters<typeof ensureEmployee>[2],
      ) => {
        if (seenEvents.has(eventKey)) return;

        const cpf = normalizeCpf(cpfValue);
        const monthKey = date.slice(0, 7);
        const value = source === 'pagamento_direto'
          ? Math.abs(Number(rawValue) || 0)
          : Number(rawValue) || 0;

        if (cpf.length !== 11 || !months.some(month => month.key === monthKey) || value <= 0) return;

        seenEvents.add(eventKey);
        const employee = ensureEmployee(cpf, date, metadata);
        employee.months[monthKey][source] += value;
        employee.months[monthKey].total += value;
        employee.total += value;
        employee.movements += 1;
      };

      payrollRows.forEach(row => addEvent(
        `folha:${row.id}`,
        row.cpf,
        row.data,
        'folha',
        row.salario_liquido,
        {
          nome: row.nome_registro || row.nome,
          unidadeCodigo: row.unidade_codigo,
          unidadeNome: row.unidade_nome,
          setorCodigo: row.setor_codigo,
          setorNome: row.setor_nome || row.setor,
        },
      ));

      benefitRows.forEach(row => {
        const source = getBenefitSource(row.tipo);
        if (!source) return;

        addEvent(
          `${source}:${row.id}`,
          row.cpf,
          row.data_beneficio,
          source,
          row.valor,
          {
            nome: row.nome,
            unidadeCodigo: row.unidade_codigo,
            unidadeNome: row.unidade_nome,
            setorCodigo: row.setor_codigo,
            setorNome: row.setor_nome,
          },
        );
      });

      paymentRows.forEach(row => {
        const cpf = normalizeCpf(row.chave_pix);
        const registration = registrationByCpf.get(cpf);
        if (!registration) return;

        addEvent(
          `pagamento:${row.id}`,
          cpf,
          row.data_lancamento,
          'pagamento_direto',
          row.valor,
          {
            nome: registration.nome || row.favorecido,
            unidadeCodigo: registration.unidade_codigo || row.unidade_codigo,
            unidadeNome: unidades.get(registration.unidade_codigo || row.unidade_codigo || '') || null,
            setorCodigo: registration.setor_codigo || row.setor_codigo,
            setorNome: setores.get(registration.setor_codigo || row.setor_codigo || '') || registration.setor,
          },
        );
      });

      const normalizedEmployees = Array.from(employeeByCpf.values())
        .map<MonitoramentoEmployee>(employee => {
          const variations = [
            calculateVariation(employee.months[months[0].key].total, employee.months[months[1].key].total),
            calculateVariation(employee.months[months[1].key].total, employee.months[months[2].key].total),
          ];

          return {
            cpf: employee.cpf,
            nome: employee.nome,
            unidadeCodigo: employee.unidadeCodigo,
            unidadeNome: employee.unidadeNome,
            setorCodigo: employee.setorCodigo,
            setorNome: employee.setorNome,
            months: employee.months,
            variations,
            total: employee.total,
            hasLargeVariation: variations.some(variation => variation.isLarge),
            movements: employee.movements,
          };
        })
        .sort((a, b) => (
          b.months[months[2].key].total - a.months[months[2].key].total
          || a.nome.localeCompare(b.nome, 'pt-BR')
        ));

      setEmployees(normalizedEmployees);
      setUpdatedAt(new Date());
    } catch (fetchError: any) {
      console.error('Erro ao carregar monitoramento de colaboradores:', fetchError);
      setError(fetchError?.message || 'Não foi possível carregar o monitoramento de colaboradores.');
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, [endDate, months, startDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    employees,
    months,
    startDate,
    endDate,
    isLoading,
    error,
    updatedAt,
    fetchData,
  };
}
