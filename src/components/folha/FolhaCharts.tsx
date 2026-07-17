import React, { useMemo } from 'react';
import {
    Area,
    Bar,
    BarChart,
    ComposedChart,
    CartesianGrid,
    Cell,
    LabelList,
    Legend,
    Line,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Activity, BarChart3, Percent, PieChart as PieIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { DadoFinanceiro } from '@/hooks/useFolhaPagamento';
import { chartTooltipContentStyle, chartTooltipCursor, chartTooltipItemStyle, chartTooltipLabelStyle } from '@/lib/chartTooltip';

const fmtBRL = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCompact = (v: number) =>
    v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
        : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#a3e635'];

const PROVENTO_FIELDS: { label: string; field: keyof DadoFinanceiro }[] = [
    { label: 'Sal. Folha', field: 'sal_folha' },
    { label: 'Pro-labore', field: 'pro_labore' },
    { label: 'Ferias', field: 'ferias' },
    { label: '13o Salario', field: 'decimo_terceiro' },
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
    { label: 'Sal. Maternidade', field: 'sal_maternidade' },
    { label: 'Vale transporte', field: 'vale_transporte' },
    { label: 'Dif. salário', field: 'dif_salario' },
];

const DESCONTO_FIELDS: { label: string; field: keyof DadoFinanceiro }[] = [
    { label: 'Desc INSS', field: 'desc_inss' },
    { label: 'I.N.S.S.', field: 'inss' },
    { label: 'INSS diferenca ferias', field: 'inss_diferenca_ferias' },
    { label: 'INSS empregador', field: 'inss_empregador' },
    { label: 'IRRF', field: 'irrf' },
    { label: 'IRRF empregador', field: 'irrf_empregador' },
    { label: 'Plano saúde', field: 'desc_plano_saude' },
    { label: 'Odonto', field: 'desc_odonto' },
    { label: 'Faltas', field: 'desc_faltas' },
    { label: 'Adiantamento', field: 'desc_adiantamento' },
    { label: 'Contribuição', field: 'contribuicao' },
    { label: 'Pensão', field: 'desc_pensao' },
    { label: 'Empréstimo', field: 'emprestimo' },
    { label: 'Fardamento', field: 'desc_fardamento' },
];

interface Props {
    data: DadoFinanceiro[];
    porSetor: { setor: string; qtd: number; liquido: number; proventos: number; descontos: number }[];
}

const getNumber = (row: DadoFinanceiro, field: keyof DadoFinanceiro) => Number(row[field]) || 0;

const getMonthKey = (value: string) => {
    if (!value) return 'Sem data';
    return value.slice(0, 7);
};

const getMonthLabel = (monthKey: string) => {
    if (monthKey === 'Sem data') return monthKey;
    const date = new Date(`${monthKey}-01T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return monthKey;
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
};

export const FolhaCharts: React.FC<Props> = ({ data, porSetor }) => {
    const barData = porSetor.slice(0, 15);

    const total = porSetor.reduce((s, p) => s + p.liquido, 0);
    const pie = porSetor.slice(0, 10).map(p => ({
        name: p.setor,
        value: p.liquido,
        pct: total > 0 ? (p.liquido / total) * 100 : 0,
    }));

    const monthlyData = useMemo(() => {
        const map = new Map<string, { mes: string; proventos: number; descontos: number; liquido: number; registros: number }>();

        data.forEach(row => {
            const key = getMonthKey(row.data);
            if (!map.has(key)) {
                map.set(key, { mes: key, proventos: 0, descontos: 0, liquido: 0, registros: 0 });
            }
            const item = map.get(key)!;
            item.proventos += Number(row.total_proventos) || 0;
            item.descontos += Number(row.total_descontos) || 0;
            item.liquido += Number(row.salario_liquido) || 0;
            item.registros += 1;
        });

        return Array.from(map.values())
            .sort((a, b) => a.mes.localeCompare(b.mes))
            .map(item => ({ ...item, label: getMonthLabel(item.mes) }));
    }, [data]);

    const descontoPorVerba = useMemo(() => {
        return DESCONTO_FIELDS
            .map(({ label, field }) => ({
                label,
                valor: data.reduce((sum, row) => sum + Math.abs(getNumber(row, field)), 0),
            }))
            .filter(item => item.valor > 0)
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 8);
    }, [data]);

    const proventoPorVerba = useMemo(() => {
        const totalProventos = data.reduce((sum, row) => sum + (Number(row.total_proventos) || 0), 0);
        return PROVENTO_FIELDS
            .map(({ label, field }) => {
                const valor = data.reduce((sum, row) => sum + Math.abs(getNumber(row, field)), 0);
                return { name: label, value: valor, pct: totalProventos > 0 ? (valor / totalProventos) * 100 : 0 };
            })
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [data]);

    const taxaDescontoPorSetor = useMemo(() => {
        return porSetor
            .filter(item => item.proventos > 0)
            .map(item => ({
                setor: item.setor,
                taxa: (item.descontos / item.proventos) * 100,
                descontos: item.descontos,
                proventos: item.proventos,
            }))
            .sort((a, b) => b.taxa - a.taxa)
            .slice(0, 12);
    }, [porSetor]);

    const mediaPorSetor = useMemo(() => {
        return porSetor
            .filter(item => item.qtd > 0)
            .map(item => ({
                setor: item.setor,
                liquidoMedio: item.liquido / item.qtd,
                custoMedio: item.proventos / item.qtd,
            }))
            .sort((a, b) => b.custoMedio - a.custoMedio)
            .slice(0, 12);
    }, [porSetor]);

    return (
        <div className="space-y-8">
            <div className="card">
                <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
                    <BarChart3 className="w-5 h-5 text-accent" /> Proventos x Descontos por Setor
                </h4>
                {barData.length > 0 ? (
                    <div style={{ height: Math.max(400, barData.length * 40 + 100) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                <XAxis dataKey="setor" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                                <YAxis tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} tickFormatter={fmtCompact} />
                                <Tooltip
                                    contentStyle={chartTooltipContentStyle}
                                    cursor={chartTooltipCursor}
                                    itemStyle={chartTooltipItemStyle}
                                    labelStyle={chartTooltipLabelStyle}
                                    formatter={(v: number) => fmtBRL(v)}
                                />
                                <Legend wrapperStyle={{ color: 'hsl(223 16% 70%)', fontSize: 12 }} />
                                <Bar dataKey="proventos" name="Proventos" fill="#22c55e" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="proventos" position="top" fill="hsl(223 16% 70%)" fontSize={10} formatter={(v: number) => v > 0 ? fmtCompact(v) : ''} />
                                </Bar>
                                <Bar dataKey="descontos" name="Descontos" fill="#ef4444" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="descontos" position="top" fill="hsl(223 16% 70%)" fontSize={10} formatter={(v: number) => v > 0 ? fmtCompact(v) : ''} />
                                </Bar>
                                <Bar dataKey="liquido" name="Líquido" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                    <LabelList dataKey="liquido" position="top" fill="hsl(223 16% 70%)" fontSize={10} formatter={(v: number) => v > 0 ? fmtCompact(v) : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-8">Nenhum dado para exibir</p>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="card">
                    <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
                        <Activity className="w-5 h-5 text-accent" /> Evolução Mensal da Folha
                    </h4>
                    {monthlyData.length > 0 ? (
                        <div style={{ height: 360 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={monthlyData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.45} />
                                    <XAxis dataKey="label" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} />
                                    <YAxis tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} tickFormatter={fmtCompact} />
                                    <Tooltip
                                        contentStyle={chartTooltipContentStyle}
                                        itemStyle={chartTooltipItemStyle}
                                        labelStyle={chartTooltipLabelStyle}
                                        formatter={(value: number) => fmtBRL(value)}
                                    />
                                    <Legend wrapperStyle={{ color: 'hsl(223 16% 70%)', fontSize: 12 }} />
                                    <Area type="monotone" dataKey="proventos" name="Proventos" stroke="#22c55e" fill="#22c55e" fillOpacity={0.18} strokeWidth={2} />
                                    <Area type="monotone" dataKey="descontos" name="Descontos" stroke="#ef4444" fill="#ef4444" fillOpacity={0.12} strokeWidth={2} />
                                    <Line type="monotone" dataKey="liquido" name="Líquido" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: '#3b82f6' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Nenhum dado para exibir</p>
                    )}
                </div>

                <div className="card">
                    <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
                        <Percent className="w-5 h-5 text-accent" /> Taxa de Desconto por Setor
                    </h4>
                    {taxaDescontoPorSetor.length > 0 ? (
                        <div style={{ height: Math.max(340, taxaDescontoPorSetor.length * 30 + 80) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={taxaDescontoPorSetor} layout="vertical" margin={{ top: 8, right: 28, left: 120, bottom: 12 }}>
                                    <XAxis type="number" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} tickFormatter={fmtPct} />
                                    <YAxis type="category" dataKey="setor" width={118} tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={chartTooltipContentStyle}
                                        cursor={chartTooltipCursor}
                                        itemStyle={chartTooltipItemStyle}
                                        labelStyle={chartTooltipLabelStyle}
                                        formatter={(value: number, name: string) => {
                                            if (name === 'taxa') return [fmtPct(value), 'Taxa'];
                                            return [fmtBRL(value), name];
                                        }}
                                    />
                                    <Bar dataKey="taxa" name="taxa" fill="#f59e0b" radius={[0, 6, 6, 0]}>
                                        <LabelList dataKey="taxa" position="right" fill="hsl(223 16% 70%)" fontSize={10} formatter={(v: number) => fmtPct(v)} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Nenhum dado para exibir</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="card">
                    <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
                        <TrendingDown className="w-5 h-5 text-accent" /> Top Verbas de Desconto
                    </h4>
                    {descontoPorVerba.length > 0 ? (
                        <div style={{ height: Math.max(330, descontoPorVerba.length * 38 + 80) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={descontoPorVerba} layout="vertical" margin={{ top: 8, right: 35, left: 100, bottom: 12 }}>
                                    <XAxis type="number" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} tickFormatter={fmtCompact} />
                                    <YAxis type="category" dataKey="label" width={98} tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={chartTooltipContentStyle}
                                        cursor={chartTooltipCursor}
                                        itemStyle={chartTooltipItemStyle}
                                        labelStyle={chartTooltipLabelStyle}
                                        formatter={(value: number) => fmtBRL(value)}
                                    />
                                    <Bar dataKey="valor" name="Valor descontado" fill="#ef4444" radius={[0, 6, 6, 0]}>
                                        <LabelList dataKey="valor" position="right" fill="hsl(223 16% 70%)" fontSize={10} formatter={(v: number) => fmtCompact(v)} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Nenhum desconto para exibir</p>
                    )}
                </div>

                <div className="card">
                    <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
                        <TrendingUp className="w-5 h-5 text-accent" /> Composição dos Proventos por Verba
                    </h4>
                    {proventoPorVerba.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-6 items-center">
                            <div style={{ height: 340 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={proventoPorVerba} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} innerRadius={58} paddingAngle={2} label={(e: any) => fmtPct(e.pct)} labelLine={false}>
                                            {proventoPorVerba.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={chartTooltipContentStyle}
                                            itemStyle={chartTooltipItemStyle}
                                            labelStyle={chartTooltipLabelStyle}
                                            formatter={(v: number, _name: string, item: any) => [fmtBRL(v), item.payload.name]}
                                            labelFormatter={() => 'Verba'}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-2">
                                {proventoPorVerba.map((p, i) => (
                                    <div key={p.name} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                            <span className="text-sm text-foreground truncate" title={p.name}>{p.name}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-sm font-bold text-foreground">{fmtBRL(p.value)}</div>
                                            <div className="text-xs text-muted-foreground">{fmtPct(p.pct)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Nenhum provento para exibir</p>
                    )}
                </div>
            </div>

            <div className="card">
                <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
                    <BarChart3 className="w-5 h-5 text-accent" /> Custo Médio x Líquido Médio por Setor
                </h4>
                {mediaPorSetor.length > 0 ? (
                    <div style={{ height: Math.max(360, mediaPorSetor.length * 36 + 90) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mediaPorSetor} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                                <XAxis dataKey="setor" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={72} />
                                <YAxis tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} tickFormatter={fmtCompact} />
                                <Tooltip
                                    contentStyle={chartTooltipContentStyle}
                                    cursor={chartTooltipCursor}
                                    itemStyle={chartTooltipItemStyle}
                                    labelStyle={chartTooltipLabelStyle}
                                    formatter={(v: number) => fmtBRL(v)}
                                />
                                <Legend wrapperStyle={{ color: 'hsl(223 16% 70%)', fontSize: 12 }} />
                                <Bar dataKey="custoMedio" name="Custo médio" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="liquidoMedio" name="Líquido médio" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-8">Nenhum dado para exibir</p>
                )}
            </div>

            <div className="card">
                <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
                    <PieIcon className="w-5 h-5 text-accent" /> Composição do Líquido por Setor
                </h4>
                {pie.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                        <div style={{ height: 360 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130} innerRadius={60} paddingAngle={2} label={(e: any) => fmtPct(e.pct)} labelLine={false}>
                                        {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={chartTooltipContentStyle}
                                        itemStyle={chartTooltipItemStyle}
                                        labelStyle={chartTooltipLabelStyle}
                                        formatter={(v: number, _name: string, item: any) => [fmtBRL(v), item.payload.name]}
                                        labelFormatter={() => 'Setor'}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                            {pie.map((p, i) => (
                                <div key={p.name} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                        <span className="text-sm text-foreground truncate" title={p.name}>{p.name}</span>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm font-bold text-foreground">{fmtBRL(p.value)}</div>
                                        <div className="text-xs text-muted-foreground">{fmtPct(p.pct)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-8">Nenhum dado para exibir</p>
                )}
            </div>
        </div>
    );
};
