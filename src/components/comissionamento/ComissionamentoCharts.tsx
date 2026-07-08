import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList,
  PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react';
import { TechnicianChartData, RankingData, FrenteKPIData } from '@/types/comissionamento';
import { chartTooltipContentStyle, chartTooltipCursor, chartTooltipItemStyle, chartTooltipLabelStyle } from '@/lib/chartTooltip';

interface Props {
  chartData: TechnicianChartData[];   // por unidade
  ranking: RankingData[];             // por favorecido (mantido na assinatura)
  frentesData?: FrenteKPIData[];      // por conta analitica
}

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const fmtCompact = (v: number) => {
  if (v >= 1000) {
    return `R$ ${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  }
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const PIE_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#a3e635',
];

export const ComissionamentoCharts: React.FC<Props> = ({ chartData, frentesData = [] }) => {
  const barData = chartData.map(d => ({
    unidade: d.nome,
    qtd: d.confirmada,
    valor: d.valor || 0,
  }));

  // Contas analiticas - despesa por conta com ticket medio
  const contaData = useMemo(() => {
    return frentesData
      .slice(0, 10)
      .map(f => ({
        conta: f.frente,
        valor: f.totalValor || 0,
        qtd: f.qtdConsultivo,
        ticketMedio: f.qtdConsultivo > 0 ? (f.totalValor || 0) / f.qtdConsultivo : 0,
      }));
  }, [frentesData]);

  const totalContas = contaData.reduce((s, c) => s + c.valor, 0);
  const pieData = contaData.map(c => ({
    name: c.conta,
    value: c.valor,
    pct: totalContas > 0 ? (c.valor / totalContas) * 100 : 0,
  }));

  return (
    <div className="space-y-8">
      {/* Lançamentos por Unidade */}
      <div className="card">
        <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
          <BarChart3 className="w-5 h-5 text-accent" />
          Lançamentos por Unidade
        </h4>
        {barData.length > 0 ? (
          <div style={{ height: Math.max(400, barData.length * 40 + 100) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <XAxis dataKey="unidade" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 12 }} interval={0} angle={-1} textAnchor="end" height={60} />
                <YAxis yAxisId="left" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={chartTooltipContentStyle}
                  cursor={chartTooltipCursor}
                  itemStyle={chartTooltipItemStyle}
                  labelStyle={chartTooltipLabelStyle}
                  formatter={(value: number, name: string) => {
                    if (name === 'Total R$') return [fmtBRL(value), name];
                    if (name === 'Lançamentos') return [value.toLocaleString('pt-BR'), name];
                    if (name === 'valor') return [fmtBRL(value), 'Total R$'];
                    if (name === 'qtd') return [value, 'Lançamentos'];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ color: 'hsl(223 16% 70%)', fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="qtd" name="Lançamentos" fill="#435e8aff" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="qtd" position="top" fill="hsl(223 16% 70%)" fontSize={10} formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
                <Bar yAxisId="right" dataKey="valor" name="Total R$" fill="#22c55e" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="valor" position="top" fill="hsl(223 16% 70%)" fontSize={10} formatter={(v: number) => v > 0 ? fmtCompact(v) : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Nenhum dado para exibir</p>
        )}
      </div>
      {/* Composição de Despesas por Conta Analítica (Pie) */}
      <div className="card">
        <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
          <PieIcon className="w-5 h-5 text-accent" />
          Composição de Despesas por Conta Analítica
        </h4>
        {pieData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={130}
                    innerRadius={60}
                    paddingAngle={2}
                    label={(e) => fmtPct(e.pct)}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipContentStyle}
                    itemStyle={chartTooltipItemStyle}
                    labelStyle={chartTooltipLabelStyle}
                    formatter={(value: number, _name: string, item: any) => [fmtBRL(value), item.payload.name]}
                    labelFormatter={() => 'Conta Analítica'}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
              {pieData.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
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

      {/* Despesa x Ticket Médio por Conta Analítica */}
      <div className="card">
        <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
          <TrendingUp className="w-5 h-5 text-accent" />
          Despesa Total x Ticket Médio por Conta Analítica
        </h4>
        {contaData.length > 0 ? (
          <div style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={contaData} margin={{ top: 20, right: 30, left: 20, bottom: 45 }}>
                <XAxis
                  dataKey="conta"
                  tick={{ fill: 'hsl(19, 16%, 70%)', fontSize: 11 }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={110}
                  tickFormatter={(value) => {
                    const texto = String(value || '');
                    return texto.length > 14 ? `${texto.slice(0, 14)}...` : texto;
                  }}
                />
                <YAxis yAxisId="left" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} tickFormatter={(v) => fmtCompact(v)} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip
                  contentStyle={chartTooltipContentStyle}
                  cursor={chartTooltipCursor}
                  itemStyle={chartTooltipItemStyle}
                  labelStyle={chartTooltipLabelStyle}
                  formatter={(value: number, name: string) => {
                    if (name === 'Despesa Total') return [fmtBRL(value), name];
                    if (name === 'Ticket Médio') return [fmtBRL(value), name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ color: 'hsl(223 16% 70%)', fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="valor" name="Despesa Total" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="ticketMedio" name="Ticket Médio" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Nenhum dado para ranking</p>
        )}
      </div>
    </div>
  );
};
