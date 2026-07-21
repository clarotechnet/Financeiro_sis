import React from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import type { FolhaCentroIndicador, FolhaDespesaComposicao } from '@/hooks/useFolhaPagamento';
import { chartTooltipContentStyle, chartTooltipCursor, chartTooltipItemStyle, chartTooltipLabelStyle } from '@/lib/chartTooltip';

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];

const fmtBRL = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtCompact = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);

const fmtPct = (value: number) =>
    `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

interface Props {
    centrosCusto: FolhaCentroIndicador[];
    composicaoDespesas: FolhaDespesaComposicao[];
}

export const FolhaCharts: React.FC<Props> = ({ centrosCusto, composicaoDespesas }) => {
    const totalDespesas = composicaoDespesas.reduce((sum, item) => sum + item.valor, 0);

    return (
        <div className="space-y-6">
            <section className="rounded-lg border border-border bg-card p-5">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <BarChart3 className="h-5 w-5 text-accent" />
                            Indicadores por Centro de Custo
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">Despesas lan&ccedil;adas em Pagamentos no per&iacute;odo selecionado.</p>
                    </div>
                    <p className="text-sm font-bold text-destructive">{fmtBRL(centrosCusto.reduce((sum, item) => sum + item.valor, 0))}</p>
                </div>

                <div style={{ height: Math.max(520, centrosCusto.length * 42) }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={centrosCusto} layout="vertical" margin={{ top: 6, right: 88, left: 24, bottom: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.45} horizontal={false} />
                            <XAxis type="number" tickFormatter={fmtCompact} tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} />
                            <YAxis
                                type="category"
                                dataKey="centro"
                                width={245}
                                tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }}
                                interval={0}
                            />
                            <Tooltip
                                contentStyle={chartTooltipContentStyle}
                                cursor={chartTooltipCursor}
                                itemStyle={chartTooltipItemStyle}
                                labelStyle={chartTooltipLabelStyle}
                                formatter={(value: number) => [fmtBRL(value), 'Despesa']}
                            />
                            <Bar dataKey="valor" name="Despesa" fill="#ef4444" radius={[0, 5, 5, 0]} minPointSize={2}>
                                <LabelList
                                    dataKey="valor"
                                    position="right"
                                    fill="hsl(223 16% 70%)"
                                    fontSize={10}
                                    formatter={(value: number) => fmtCompact(value)}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <PieChartIcon className="h-5 w-5 text-accent" />
                            Composi&ccedil;&atilde;o de Todas as Despesas
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">Participa&ccedil;&atilde;o de cada conta anal&iacute;tica no total de pagamentos.</p>
                    </div>
                    <p className="text-sm font-bold text-destructive">Total: {fmtBRL(totalDespesas)}</p>
                </div>

                {composicaoDespesas.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma despesa encontrada no per&iacute;odo.</p>
                ) : (
                    <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.15fr)]">
                        <div className="h-[430px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={composicaoDespesas}
                                        dataKey="valor"
                                        nameKey="rubrica"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={150}
                                        paddingAngle={1}
                                    >
                                        {composicaoDespesas.map((item, index) => (
                                            <Cell key={item.rubrica} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={chartTooltipContentStyle}
                                        itemStyle={chartTooltipItemStyle}
                                        labelStyle={chartTooltipLabelStyle}
                                        formatter={(value: number) => fmtBRL(value)}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="max-h-[430px] overflow-y-auto pr-2">
                            {composicaoDespesas.map((item, index) => (
                                <div key={item.rubrica} className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="truncate text-sm text-foreground" title={item.rubrica}>{item.rubrica}</span>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-sm font-bold text-foreground">{fmtBRL(item.valor)}</p>
                                        <p className="text-xs text-muted-foreground">{fmtPct(item.percentual)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};
