import React from 'react';
import { ClipboardList, DollarSign, Building2 } from 'lucide-react';
import { ComissionamentoKPIData } from '@/types/comissionamento';

interface KPICardProps {
  value: string | number;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
}

const KPICard: React.FC<KPICardProps> = ({ value, label, sub, icon, gradient }) => (
  <div className="kpi-card">
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
            maxWidth: '100%'
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
  </div>
);

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
}

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ComissionamentoKPIs: React.FC<Props> = ({ kpis }) => {
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
