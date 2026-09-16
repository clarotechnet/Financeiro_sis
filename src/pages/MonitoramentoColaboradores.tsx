import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  MonitoramentoBreakdown,
  MonitoramentoEmployee,
  MonitoramentoVariation,
  useMonitoramentoColaboradores,
} from '@/hooks/useMonitoramentoColaboradores';
import {
  chartTooltipContentStyle,
  chartTooltipCursor,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
} from '@/lib/chartTooltip';

const PAGE_SIZE = 25;

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const formatCompactCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value);

const formatCpf = (cpf: string) => cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');

const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

const benefitTotal = (breakdown: MonitoramentoBreakdown) => (
  breakdown.combustivel + breakdown.agregamento + breakdown.flash
);

const SETOR_GROUPS = [
  {
    id: 'administrativo',
    label: 'Administrativo',
    nomes: [
      'Administrativo',
      'Manutenção / Suporte / Garantia',
      'Limpeza',
      'DP / RH',
      'Financeiro',
      'Estoque',
      'Segurança do Trabalho - SST',
      'Diretoria / Sócios',
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    nomes: [
      'Comercial PPAP',
      'Comercial TELEMARKETING',
      'Comercial Gestão',
      'Comercial MDU',
      'Comercial BKO',
      'Comercial P1',
      'Comercial P2',
      'Comercial Bônus FPD',
      'Comercial Bônus VPC',
      'Afastamento Comercial',
    ],
  },
  {
    id: 'tecnica',
    label: 'Técnica',
    nomes: [
      'Técnico de Campo — ADS & SERVIÇOS',
      'Técnico de Campo — Desconexão',
      'Técnico de Campo — VT por equipe',
      'Técnico de Campo — MDU - Manutenção',
      'Técnico de Campo — MDU - Construção',
      'Técnica — Consultivo',
      'Técnica — Gestão',
      'Suporte de Campo — ADS & SERVIÇOS',
      'Suporte de Campo — Desconexão',
      'Suporte de Campo — VT por equipe',
      'Suporte de Campo — MDU - Manutenção',
      'Suporte de Campo — MDU - Construção',
      'Suporte Sistema',
      'Afastamento Técnica',
    ],
  },
] as const;

type SetorGroupId = typeof SETOR_GROUPS[number]['id'];

const normalizeSectorLabel = (value: string) => normalizeSearch(value)
  .replace(/[—–]/g, '-')
  .replace(/\s+/g, ' ')
  .replace(/\s*-\s*/g, ' - ')
  .trim();

interface FilterMultiSelectProps {
  label: string;
  allLabel: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const FilterMultiSelect: React.FC<FilterMultiSelectProps> = ({
  label,
  allLabel,
  options,
  selected,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option => (
    normalizeSearch(option).includes(normalizeSearch(search.trim()))
  ));

  const toggleOption = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter(item => item !== option)
        : [...selected, option],
    );
  };

  const displayValue = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionado(s)`;

  return (
    <div ref={ref} className="form-group" style={{ position: 'relative', zIndex: isOpen ? 60 : 1 }}>
      <Label className="form-label">{label}</Label>
      <button
        type="button"
        className={`multi-select-button w-full ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(current => !current)}
        aria-expanded={isOpen}
        aria-label={`${label}: ${displayValue}`}
      >
        <span className="multi-select-text">{displayValue}</span>
        {selected.length > 0 && <span className="selected-count">{selected.length}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="multi-select-dropdown open">
          <div className="relative border-b border-border">
            <Input
              className="h-9 rounded-none border-0 pr-9 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Buscar..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
                aria-label={`Limpar busca de ${label.toLocaleLowerCase('pt-BR')}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              className="w-full border-b border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </button>
          )}
          {filteredOptions.map(option => (
            <button
              key={option}
              type="button"
              className="multi-select-option w-full text-left"
              onClick={() => toggleOption(option)}
            >
              <span className={`multi-select-checkbox ${selected.includes(option) ? 'checked' : ''}`} />
              <span>{option}</span>
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</div>
          )}
        </div>
      )}
    </div>
  );
};

const VariationBadge: React.FC<{ variation: MonitoramentoVariation }> = ({ variation }) => {
  if (variation.kind === 'none') {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  if (variation.kind === 'new') {
    return (
      <span className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-300">
        Novo
      </span>
    );
  }

  const isUp = variation.kind === 'up';
  const Icon = isUp ? TrendingUp : variation.kind === 'down' ? TrendingDown : Activity;
  const colorClass = variation.isLarge
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    : isUp
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300';

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {variation.percent?.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  );
};

const BreakdownDetail: React.FC<{
  breakdown: MonitoramentoBreakdown;
}> = ({ breakdown }) => {
  const items = [
    { label: 'Folha líquida', value: breakdown.folha },
    { label: 'Agregamento', value: breakdown.agregamento },
    { label: 'Flash', value: breakdown.flash },
    { label: 'Combustível', value: breakdown.combustivel },
    { label: 'Pagamentos diretos', value: breakdown.pagamento_direto },
  ].filter(item => item.value > 0);

  if (items.length === 0) {
    return <p className="py-3 text-xs text-muted-foreground">Sem recebimentos neste mês.</p>;
  }

  return (
    <div className="space-y-2 py-3">
      {items.map(item => (
        <div key={item.label} className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted-foreground">{item.label}</span>
          <strong className="text-foreground">{formatCurrency(item.value)}</strong>
        </div>
      ))}
    </div>
  );
};

const MonitoramentoColaboradores: React.FC = () => {
  const navigate = useNavigate();
  const { employees, months, isLoading, error, updatedAt, fetchData } = useMonitoramentoColaboradores();
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [sectorFilter, setSectorFilter] = useState<string[]>([]);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [page, setPage] = useState(0);
  const [expandedCpfs, setExpandedCpfs] = useState<Set<string>>(new Set());

  const unitOptions = useMemo(() => Array.from(new Set(
    employees.map(employee => employee.unidadeNome).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, 'pt-BR')), [employees]);

  const sectorOptions = useMemo(() => Array.from(new Set(
    employees.map(employee => employee.setorNome).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, 'pt-BR')), [employees]);

  const sectorNamesByGroup = useMemo(() => {
    const namesByGroup = {} as Record<SetorGroupId, string[]>;

    SETOR_GROUPS.forEach(group => {
      const groupNames = new Set(group.nomes.map(normalizeSectorLabel));
      namesByGroup[group.id] = sectorOptions.filter(option => (
        groupNames.has(normalizeSectorLabel(option))
      ));
    });

    return namesByGroup;
  }, [sectorOptions]);

  const activeSectorGroups = useMemo(() => {
    const selectedSectors = new Set(sectorFilter);

    return new Set(
      SETOR_GROUPS
        .filter(group => {
          const groupSectors = sectorNamesByGroup[group.id];
          return groupSectors.length > 0
            && groupSectors.every(sector => selectedSectors.has(sector));
        })
        .map(group => group.id),
    );
  }, [sectorFilter, sectorNamesByGroup]);

  const filteredEmployees = useMemo(() => {
    const normalized = normalizeSearch(search);
    const digits = search.replace(/\D/g, '');

    return employees.filter(employee => {
      const matchesSearch = !normalized
        || normalizeSearch(employee.nome).includes(normalized)
        || (digits.length > 0 && employee.cpf.includes(digits));
      const matchesUnit = unitFilter.length === 0 || unitFilter.includes(employee.unidadeNome);
      const matchesSector = sectorFilter.length === 0 || sectorFilter.includes(employee.setorNome);
      const matchesAlert = !onlyAlerts || employee.hasLargeVariation;
      return matchesSearch && matchesUnit && matchesSector && matchesAlert;
    });
  }, [employees, onlyAlerts, search, sectorFilter, unitFilter]);

  const summary = useMemo(() => filteredEmployees.reduce((acc, employee) => {
    Object.values(employee.months).forEach(month => {
      acc.folha += month.folha;
      acc.beneficios += benefitTotal(month);
      acc.pagamentos += month.pagamento_direto;
    });
    acc.total += employee.total;
    if (employee.hasLargeVariation) acc.alertas += 1;
    return acc;
  }, {
    total: 0,
    folha: 0,
    beneficios: 0,
    pagamentos: 0,
    alertas: 0,
  }), [filteredEmployees]);

  const monthlyChartData = useMemo(() => months.map(month => {
    const totals = filteredEmployees.reduce((acc, employee) => {
      const breakdown = employee.months[month.key];
      acc.folha += breakdown.folha;
      acc.agregamento += breakdown.agregamento;
      acc.flash += breakdown.flash;
      acc.combustivel += breakdown.combustivel;
      acc.pagamento_direto += breakdown.pagamento_direto;
      return acc;
    }, {
      folha: 0,
      agregamento: 0,
      flash: 0,
      combustivel: 0,
      pagamento_direto: 0,
    });

    return { month: month.label, ...totals };
  }), [filteredEmployees, months]);

  const sectorChartData = useMemo(() => {
    const totals = new Map<string, number>();
    filteredEmployees.forEach(employee => {
      totals.set(employee.setorNome, (totals.get(employee.setorNome) || 0) + employee.total);
    });

    return Array.from(totals.entries())
      .map(([setor, total]) => ({ setor, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredEmployees]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const paginatedEmployees = filteredEmployees.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [onlyAlerts, search, sectorFilter, unitFilter]);

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  const toggleExpanded = (cpf: string) => {
    setExpandedCpfs(current => {
      const next = new Set(current);
      if (next.has(cpf)) next.delete(cpf);
      else next.add(cpf);
      return next;
    });
  };

  const handleSectorGroupChange = (groupId: SetorGroupId) => {
    const groupSectors = sectorNamesByGroup[groupId];

    setSectorFilter(currentSectors => {
      const nextSectors = new Set(currentSectors);
      const groupIsActive = groupSectors.every(sector => nextSectors.has(sector));

      groupSectors.forEach(sector => {
        if (groupIsActive) nextSectors.delete(sector);
        else nextSectors.add(sector);
      });

      return sectorOptions.filter(sector => nextSectors.has(sector));
    });
  };

  if (isLoading && employees.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Carregando monitoramento dos últimos três meses...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1700px] space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Configurações</p>
              <h1 className="text-xl font-extrabold text-foreground md:text-2xl">Monitoramento de Colaboradores</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Recebimentos por CPF de {months[0].fullLabel} a {months[2].fullLabel}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/configuracoes')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Configurações
            </Button>
            <Button variant="outline" onClick={fetchData} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Atualizar
            </Button>
          </div>
        </header>

        {error && (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchData}>Tentar novamente</Button>
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Card className="border-t-2 border-t-primary">
            <CardHeader className="pb-2"><CardDescription>Total recebido</CardDescription></CardHeader>
            <CardContent><p className="text-xl font-extrabold text-foreground">{formatCurrency(summary.total)}</p></CardContent>
          </Card>
          <Card className="border-t-2 border-t-emerald-500">
            <CardHeader className="pb-2"><CardDescription>Folha líquida</CardDescription></CardHeader>
            <CardContent><p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.folha)}</p></CardContent>
          </Card>
          <Card className="border-t-2 border-t-blue-500">
            <CardHeader className="pb-2"><CardDescription>Benefícios</CardDescription></CardHeader>
            <CardContent><p className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(summary.beneficios)}</p></CardContent>
          </Card>
          <Card className="border-t-2 border-t-teal-500">
            <CardHeader className="pb-2"><CardDescription>Pagamentos diretos</CardDescription></CardHeader>
            <CardContent><p className="text-xl font-extrabold text-teal-600 dark:text-teal-400">{formatCurrency(summary.pagamentos)}</p></CardContent>
          </Card>
          <Card className="border-t-2 border-t-slate-500">
            <CardHeader className="pb-2"><CardDescription>Colaboradores</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-extrabold text-foreground">{filteredEmployees.length}</p></CardContent>
          </Card>
          <button
            type="button"
            onClick={() => setOnlyAlerts(current => !current)}
            aria-pressed={onlyAlerts}
            aria-label={`${onlyAlerts ? 'Desativar' : 'Ativar'} filtro de variações relevantes`}
            className={`rounded-lg border border-t-2 border-t-amber-500 bg-card p-6 text-left text-card-foreground shadow-sm transition-colors hover:bg-amber-500/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${onlyAlerts ? 'border-amber-500/60 bg-amber-500/[0.08]' : 'border-border'}`}
          >
            <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              Variações relevantes
              <span className={`text-[10px] font-bold uppercase ${onlyAlerts ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                {onlyAlerts ? 'Filtro ativo' : 'Filtrar'}
              </span>
            </span>
            <span className="mt-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{summary.alertas}</span>
            </span>
          </button>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 md:p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1.4fr)_minmax(200px,1fr)_minmax(200px,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="monitoramento-search">Buscar colaborador</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="monitoramento-search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Nome ou CPF"
                  className="pl-9"
                />
              </div>
            </div>
            <FilterMultiSelect
              label="Unidade"
              allLabel="Todas"
              options={unitOptions}
              selected={unitFilter}
              onChange={setUnitFilter}
            />
            <FilterMultiSelect
              label="Setor"
              allLabel="Todos"
              options={sectorOptions}
              selected={sectorFilter}
              onChange={setSectorFilter}
            />
            <div className="flex h-10 items-center gap-3 rounded-md border border-input px-3">
              <Switch id="only-alerts" checked={onlyAlerts} onCheckedChange={setOnlyAlerts} />
              <Label htmlFor="only-alerts" className="whitespace-nowrap text-sm">Somente variações</Label>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:gap-3">
            <Label className="text-sm font-semibold text-foreground">Filtro geral de Setor</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro geral de Setor">
              {SETOR_GROUPS.map(group => {
                const isActive = activeSectorGroups.has(group.id);

                return (
                  <Button
                    key={group.id}
                    type="button"
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={isActive}
                    disabled={sectorNamesByGroup[group.id].length === 0}
                    onClick={() => handleSectorGroupChange(group.id)}
                    className="min-w-[118px]"
                  >
                    {group.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Variação relevante: alteração igual ou superior a 30% entre meses consecutivos.</span>
            <span>Sem duplicidade: importações da Folha e dos Benefícios em Pagamentos são desconsideradas.</span>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.75fr)]">
          <div className="rounded-lg border border-border bg-card p-4 md:p-5">
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <WalletCards className="h-5 w-5 text-primary" />
                Composição mensal dos recebimentos
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Os valores acompanham os filtros aplicados.</p>
            </div>
            <div className="h-[360px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tickFormatter={formatCompactCurrency} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={78} />
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    itemStyle={chartTooltipItemStyle}
                    labelStyle={chartTooltipLabelStyle}
                    cursor={chartTooltipCursor}
                    formatter={(value: number, name: string) => [formatCurrency(Number(value)), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="folha" name="Folha líquida" stackId="total" fill="#10b981" />
                  <Bar dataKey="agregamento" name="Agregamento" stackId="total" fill="#ef4444" />
                  <Bar dataKey="flash" name="Flash" stackId="total" fill="#f59e0b" />
                  <Bar dataKey="combustivel" name="Combustível" stackId="total" fill="#3b82f6" />
                  <Bar dataKey="pagamento_direto" name="Pagamentos diretos" stackId="total" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 md:p-5">
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <Building2 className="h-5 w-5 text-primary" />
                Maiores valores por setor
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Top 8 no período monitorado.</p>
            </div>
            {sectorChartData.length === 0 ? (
              <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">Nenhum setor encontrado.</div>
            ) : (
              <div className="h-[360px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorChartData} layout="vertical" margin={{ top: 4, right: 24, left: 18, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} horizontal={false} />
                    <XAxis type="number" tickFormatter={formatCompactCurrency} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="setor"
                      width={145}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      tickFormatter={value => value.length > 24 ? `${value.slice(0, 23)}…` : value}
                    />
                    <Tooltip
                      contentStyle={chartTooltipContentStyle}
                      itemStyle={chartTooltipItemStyle}
                      labelStyle={chartTooltipLabelStyle}
                      cursor={chartTooltipCursor}
                      formatter={(value: number) => [formatCurrency(Number(value)), 'Recebido']}
                    />
                    <Bar dataKey="total" name="Recebido" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <Users className="h-5 w-5 text-primary" />
                Recebimentos por colaborador
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{filteredEmployees.length} CPF(s) encontrado(s)</p>
            </div>
            {updatedAt && (
              <span className="text-xs text-muted-foreground">
                Atualizado em {updatedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] border-collapse text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3" aria-label="Detalhes" />
                  <th className="px-3 py-3">Nome</th>
                  <th className="px-3 py-3">CPF</th>
                  <th className="px-3 py-3">Setor</th>
                  <th className="px-3 py-3 text-right">{months[0].label}</th>
                  <th className="px-3 py-3 text-center">Variação</th>
                  <th className="px-3 py-3 text-right">{months[1].label}</th>
                  <th className="px-3 py-3 text-center">Variação</th>
                  <th className="px-3 py-3 text-right">
                    <span className="block">{months[2].label}</span>
                    {months[2].isCurrent && <span className="normal-case font-normal">mês atual</span>}
                  </th>
                  <th className="px-3 py-3 text-right">Total 3 meses</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((employee: MonitoramentoEmployee) => {
                  const expanded = expandedCpfs.has(employee.cpf);
                  return (
                    <Fragment key={employee.cpf}>
                      <tr className={`border-t border-border transition-colors hover:bg-muted/25 ${employee.hasLargeVariation ? 'bg-amber-500/[0.035]' : ''}`}>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(employee.cpf)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={expanded ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                            aria-expanded={expanded}
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <strong className="block max-w-[260px] truncate text-foreground" title={employee.nome}>{employee.nome}</strong>
                          <span className="block max-w-[260px] truncate text-xs text-muted-foreground" title={employee.unidadeNome}>{employee.unidadeNome}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-medium text-foreground">{formatCpf(employee.cpf)}</td>
                        <td className="px-3 py-3">
                          <span className="block max-w-[260px] truncate text-foreground" title={employee.setorNome}>{employee.setorNome}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{formatCurrency(employee.months[months[0].key].total)}</td>
                        <td className="px-3 py-3 text-center"><VariationBadge variation={employee.variations[0]} /></td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{formatCurrency(employee.months[months[1].key].total)}</td>
                        <td className="px-3 py-3 text-center"><VariationBadge variation={employee.variations[1]} /></td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">{formatCurrency(employee.months[months[2].key].total)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-extrabold text-foreground">{formatCurrency(employee.total)}</td>
                      </tr>
                      {expanded && (
                        <tr className="border-t border-border bg-muted/20">
                          <td colSpan={10} className="px-4 py-2 md:px-12">
                            <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
                              {months.map(month => (
                                <div key={month.key} className="px-4 py-3 first:pl-0 last:pr-0">
                                  <div className="flex items-center justify-between gap-3">
                                    <strong className="text-sm text-foreground">{month.fullLabel}</strong>
                                    <span className="text-sm font-extrabold text-foreground">{formatCurrency(employee.months[month.key].total)}</span>
                                  </div>
                                  <BreakdownDetail breakdown={employee.months[month.key]} />
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {paginatedEmployees.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      Nenhum colaborador encontrado para os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between md:px-5">
            <span className="text-muted-foreground">
              {filteredEmployees.length === 0 ? '0' : `${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, filteredEmployees.length)}`} de {filteredEmployees.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-20 text-center text-xs font-semibold">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="icon" onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1} aria-label="Próxima página">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5" /> Folha usa o salário líquido do CPF.</span>
          <span className="inline-flex items-center gap-1.5"><Gift className="h-3.5 w-3.5" /> Benefícios usam as bases originais.</span>
          <span className="inline-flex items-center gap-1.5"><WalletCards className="h-3.5 w-3.5" /> Pagamentos diretos exigem status PAGO e PIX igual ao CPF.</span>
        </footer>
      </div>
    </div>
  );
};

export default MonitoramentoColaboradores;
