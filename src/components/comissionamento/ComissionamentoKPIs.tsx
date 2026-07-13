import React, { useMemo, useState } from 'react';
import { Building2, ClipboardList, DollarSign, ListChecks } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ComissionamentoKPIData, LancamentoPix } from '@/types/comissionamento';

interface KPICardProps {
  value: string | number;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ value, label, sub, icon, gradient, onClick }) => {
  const content = (
    <div className="kpi-header">
      <div className="min-w-0 flex-1">
        <div
          className="kpi-value truncate text-lg"
          style={{
            backgroundImage: gradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'inline-block',
            maxWidth: '100%',
          }}
        >
          {value}
        </div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </div>
      <div className="kpi-icon flex-shrink-0" style={{ background: gradient }}>
        {icon}
      </div>
    </div>
  );

  if (!onClick) return <div className="kpi-card">{content}</div>;

  return (
    <button
      type="button"
      className="kpi-card w-full text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/60"
      onClick={onClick}
    >
      {content}
    </button>
  );
};

const GRADIENTS = [
  'linear-gradient(135deg, #43e97b 0%, #38ef7d 100%)',
  'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
];

interface Props {
  kpis: ComissionamentoKPIData;
  lancamentos?: LancamentoPix[];
}

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const getUnidadeKey = (row: LancamentoPix) => row.unidade || 'Sem Unidade';

const getCentroCustoLabel = (row: LancamentoPix) =>
  row.setor_nome || row.centro_de_custo || '-';

const getBancoLabel = (row: LancamentoPix) =>
  row.banco_cadastro || row.banco || '-';

export const ComissionamentoKPIs: React.FC<Props> = ({ kpis, lancamentos = [] }) => {
  const [selectedUnidade, setSelectedUnidade] = useState<ComissionamentoKPIData['porUnidade'][number] | null>(null);

  const selectedLancamentos = useMemo(() => {
    if (!selectedUnidade) return [];

    return lancamentos
      .filter(row => getUnidadeKey(row) === selectedUnidade.unidade)
      .sort((a, b) => {
        const dateCompare = (b.data_lancamento || '').localeCompare(a.data_lancamento || '');
        if (dateCompare !== 0) return dateCompare;
        const createdCompare = (a.created_at || '').localeCompare(b.created_at || '');
        if (createdCompare !== 0) return createdCompare;
        return (a.id || '').localeCompare(b.id || '');
      });
  }, [lancamentos, selectedUnidade]);

  const selectedTotal = selectedLancamentos.reduce((sum, row) => sum + (row.valor || 0), 0);
  const selectedFavorecidos = new Set(selectedLancamentos.map(row => row.favorecido).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div className="kpi-grid">
        <KPICard
          value={kpis.total.toLocaleString('pt-BR')}
          label="Total de Lançamentos"
          icon={<ClipboardList className="w-6 h-6 text-white" />}
          gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        />
        <KPICard
          value={fmtBRL(kpis.totalValor)}
          label="Total R$ no Período"
          icon={<DollarSign className="w-6 h-6 text-white" />}
          gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
        />
      </div>

      <div>
        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-accent" />
          Total por Unidade
        </h4>
        {kpis.porUnidade.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum dado para exibir.</p>
        ) : (
          <div className="kpi-grid">
            {kpis.porUnidade.map((u, i) => (
              <KPICard
                key={u.unidade}
                value={fmtBRL(u.valor)}
                label={u.unidade}
                sub={`${u.total.toLocaleString('pt-BR')} lançamento(s)`}
                icon={<Building2 className="w-6 h-6 text-white" />}
                gradient={GRADIENTS[i % GRADIENTS.length]}
                onClick={() => setSelectedUnidade(u)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedUnidade} onOpenChange={(open) => { if (!open) setSelectedUnidade(null); }}>
        <DialogContent className="max-w-6xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              {selectedUnidade?.unidade || 'Detalhes da unidade'}
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
                    <tr key={row.id || `${row.data_lancamento}-${row.favorecido}-${row.valor}`} className="border-t border-border align-top">
                      <td className="px-3 py-3 whitespace-nowrap font-medium">{fmtDate(row.data_lancamento)}</td>
                      <td className="px-3 py-3">{row.unidade || '-'}</td>
                      <td className="px-3 py-3 font-semibold text-foreground">{row.favorecido || '-'}</td>
                      <td className="px-3 py-3">{getCentroCustoLabel(row)}</td>
                      <td className="px-3 py-3">{getBancoLabel(row)}</td>
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
                        Nenhum lançamento encontrado para esta unidade nos filtros atuais.
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
