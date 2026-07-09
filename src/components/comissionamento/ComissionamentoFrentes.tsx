import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Tags, Building2, Banknote, Users, ListChecks } from 'lucide-react';
import { FrenteKPIData, LancamentoPix } from '@/types/comissionamento';
import { chartTooltipContentStyle, chartTooltipCursor, chartTooltipItemStyle, chartTooltipLabelStyle } from '@/lib/chartTooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  frentesData: FrenteKPIData[];
  selectedFrente: string;
  lancamentos?: LancamentoPix[];
}

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const stripContaCodigo = (value: string | null | undefined) =>
  (value || '').replace(/^\d{2}-\d{2}-\d{3}\s*-\s*/, '').trim();

const getContaLabel = (row: LancamentoPix) =>
  stripContaCodigo(row.conta_analitica) || 'Sem Conta Analítica';

export const ComissionamentoFrentes: React.FC<Props> = ({ frentesData, selectedFrente, lancamentos = [] }) => {
  const [selectedCard, setSelectedCard] = useState<FrenteKPIData | null>(null);
  const displayData = selectedFrente
    ? frentesData.filter(f => f.frente === selectedFrente)
    : frentesData;

  const selectedLancamentos = useMemo(() => {
    if (!selectedCard) return [];
    return lancamentos
      .filter(row => getContaLabel(row) === selectedCard.frente)
      .sort((a, b) => {
        const dateCompare = (b.data_lancamento || '').localeCompare(a.data_lancamento || '');
        if (dateCompare !== 0) return dateCompare;
        const createdCompare = (a.created_at || '').localeCompare(b.created_at || '');
        if (createdCompare !== 0) return createdCompare;
        return (a.id || '').localeCompare(b.id || '');
      });
  }, [lancamentos, selectedCard]);

  const selectedTotal = selectedLancamentos.reduce((sum, row) => sum + (row.valor || 0), 0);
  const selectedFavorecidos = new Set(selectedLancamentos.map(row => row.favorecido).filter(Boolean)).size;

  const chartData = displayData.slice(0, 15).map(f => ({
      conta: f.frente,
      valor: f.totalValor || 0,
      qtd: f.qtdConsultivo,
    }));

  return (
    <div className="space-y-8">
      {/* Cards por Conta Analítica */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayData.map(f => (
          <button
            key={f.frente}
            type="button"
            className="card w-full space-y-3 text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/60"
            onClick={() => setSelectedCard(f)}
          >
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
                  {f.contasAnaliticas && f.contasAnaliticas.length > 0 && !f.contasAnaliticas.includes(f.frente) && (
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
          </button>
        ))}
        {displayData.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-6">
            Nenhuma conta analítica encontrada.
          </p>
        )}
      </div>

      {/* Bar Chart - Top 15 contas analíticas por valor */}
      {chartData.length > 1 && (
        <div className="card">
          <h4 className="mb-6 flex items-center gap-2 text-lg font-bold">
            <Banknote className="w-5 h-5 text-accent" />
            Top {chartData.length} Contas Analíticas — Total Pago
          </h4>
          <div style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <XAxis
                  dataKey="conta"
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

      <Dialog open={!!selectedCard} onOpenChange={(open) => { if (!open) setSelectedCard(null); }}>
        <DialogContent className="max-w-6xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              {selectedCard?.frente || 'Detalhes da conta'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Total pago</div>
              <div className="mt-1 text-2xl font-black text-primary">{fmtBRL(selectedTotal)}</div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Lançamentos</div>
              <div className="mt-1 text-2xl font-black text-foreground">{selectedLancamentos.length}</div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Favorecidos</div>
              <div className="mt-1 text-2xl font-black text-foreground">{selectedFavorecidos}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="max-h-[55vh] overflow-auto">
              <table className="w-full min-w-[980px] text-xs">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-3 font-semibold">Data</th>
                    <th className="px-3 py-3 font-semibold">Unidade</th>
                    <th className="px-3 py-3 font-semibold">Favorecido</th>
                    <th className="px-3 py-3 font-semibold">Centro de Custo</th>
                    <th className="px-3 py-3 font-semibold">Banco</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Observação</th>
                    <th className="px-3 py-3 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedLancamentos.map(row => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="px-3 py-3 whitespace-nowrap font-medium">{fmtDate(row.data_lancamento)}</td>
                      <td className="px-3 py-3">{row.unidade || '-'}</td>
                      <td className="px-3 py-3 font-semibold text-foreground">{row.favorecido || '-'}</td>
                      <td className="px-3 py-3">{row.centro_de_custo || '-'}</td>
                      <td className="px-3 py-3">{row.banco || '-'}</td>
                      <td className="px-3 py-3">
                        {row.status_pag ? (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${(row.status_pag || '').toUpperCase() === 'PAGO'
                            ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                            : 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                          }`}>
                            {row.status_pag}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-3 max-w-[240px] break-words">{row.descricao || '-'}</td>
                      <td className="px-3 py-3 text-right font-bold whitespace-nowrap">{fmtBRL(row.valor || 0)}</td>
                    </tr>
                  ))}
                  {selectedLancamentos.length === 0 && (
                    <tr>
                      <td className="px-3 py-8 text-center text-muted-foreground" colSpan={8}>
                        Nenhum lançamento encontrado para esta conta nos filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
