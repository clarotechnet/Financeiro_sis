import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Tags, Building2, Banknote, Users } from 'lucide-react';
import { FrenteKPIData } from '@/types/comissionamento';
import { chartTooltipContentStyle, chartTooltipCursor, chartTooltipItemStyle, chartTooltipLabelStyle } from '@/lib/chartTooltip';

interface Props {
  frentesData: FrenteKPIData[];
  selectedFrente: string;
}

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ComissionamentoFrentes: React.FC<Props> = ({ frentesData, selectedFrente }) => {
  const displayData = selectedFrente
    ? frentesData.filter(f => f.frente === selectedFrente)
    : frentesData;

  const chartData = displayData.slice(0, 15).map(f => ({
    categoria: f.frente,
    valor: f.totalValor || 0,
    qtd: f.qtdConsultivo,
  }));

  return (
    <div className="space-y-8">
      {/* Cards por Favorecido */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayData.map(f => (
          <div key={f.frente} className="card space-y-3">
            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Tags className="w-4 h-4 text-accent" />
              <span className="truncate" title={f.frente}>{f.frente}</span>
            </h4>

            <div className="space-y-2">
              <div>
                <div className="text-xs text-muted-foreground">Total Pago</div>
                <div className="text-2xl font-black text-accent">{fmtBRL(f.totalValor || 0)}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Banknote className="w-3 h-3" /> Lanç.
                  </div>
                  <div className="text-lg font-bold text-foreground">{f.qtdConsultivo}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> Favoreci.
                  </div>
                  <div className="text-lg font-bold text-foreground">{f.totalTecnicos}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">% Total</div>
                  <div className="text-lg font-bold" style={{ color: f.pctConfirmada >= 10 ? '#22c55e' : '#f59e0b' }}>
                    {f.pctConfirmada.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </div>
                </div>
              </div>

              {(f.unidade || (f.contasAnaliticas && f.contasAnaliticas.length > 0)) && (
                <div className="pt-2 border-t border-border space-y-1">
                  {f.unidade && (
                    <div className="text-xs flex items-center gap-1 text-muted-foreground">
                      <Building2 className="w-3 h-3" />
                      <span className="truncate" title={f.unidade}>{f.unidade}</span>
                    </div>
                  )}
                  {f.contasAnaliticas && f.contasAnaliticas.length > 0 && (
                    <div
                      className="text-xs text-muted-foreground truncate"
                      title={f.contasAnaliticas.join(', ')}
                    >
                      Conta Analítica: {f.contasAnaliticas.length === 1
                        ? f.contasAnaliticas[0]
                        : `${f.contasAnaliticas.length} contas classificadas`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {displayData.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-6">
            Nenhuma categoria encontrada.
          </p>
        )}
      </div>

      {/* Bar Chart - Top 15 favorecidos por valor */}
      {chartData.length > 1 && (
        <div className="card">
          <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
            <Banknote className="w-5 h-5 text-accent" />
            Top {chartData.length} Categorias — Total Pago
          </h4>
          <div style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <XAxis
                  dataKey="categoria"
                  tick={{ fill: 'hsl(223 16% 70%)', fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />
                <YAxis tick={{ fill: 'hsl(223 16% 70%)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={chartTooltipContentStyle}
                  cursor={chartTooltipCursor}
                  itemStyle={chartTooltipItemStyle}
                  labelStyle={chartTooltipLabelStyle}
                  formatter={(value: number, name: string) => {
                    if (name === 'Total R$') return [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                    if (name === 'valor') return [fmtBRL(value), 'Total'];
                    if (name === 'qtd') return [value.toLocaleString('pt-BR'), 'Qtd'];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ color: 'hsl(223 16% 70%)', fontSize: 12 }} />
                <Bar dataKey="valor" name="Total R$" fill="#22c55e" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="valor"
                    position="top"
                    fill="hsl(223 16% 70%)"
                    fontSize={10}
                    formatter={(v: number) => v > 0 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
