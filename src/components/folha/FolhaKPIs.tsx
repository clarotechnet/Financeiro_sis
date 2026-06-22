import React from 'react';
import { Users, TrendingUp, TrendingDown, Wallet, Building2 } from 'lucide-react';

const fmtBRL = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
    kpis: {
        total: number;
        proventos: number;
        descontos: number;
        liquido: number;
        porSetor: { setor: string; qtd: number; liquido: number; proventos: number; descontos: number }[];
    };
}

const GRAD = [
    'linear-gradient(135deg, #43e97b 0%, #38ef7d 100%)',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
];

const Card: React.FC<{ value: string | number; label: string; sub?: string; icon: React.ReactNode; gradient: string }> = ({ value, label, sub, icon, gradient }) => (
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
            <div className="kpi-icon flex-shrink-0" style={{ background: gradient }}>{icon}</div>
        </div>
    </div>
);

export const FolhaKPIs: React.FC<Props> = ({ kpis }) => (
    <div className="space-y-6">
        <div className="kpi-grid">
            <Card value={kpis.total.toLocaleString('pt-BR')} label="Total de Registros" icon={<Users className="w-6 h-6 text-white" />} gradient={GRAD[1]} />
            <Card value={fmtBRL(kpis.proventos)} label="Total de Proventos" icon={<TrendingUp className="w-6 h-6 text-white" />} gradient={GRAD[0]} />
            <Card value={fmtBRL(kpis.descontos)} label="Total de Descontos" icon={<TrendingDown className="w-6 h-6 text-white" />} gradient={GRAD[3]} />
            <Card value={fmtBRL(kpis.liquido)} label="Salário Líquido Total" icon={<Wallet className="w-6 h-6 text-white" />} gradient={GRAD[4]} />
        </div>

        <div>
            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-accent" /> Líquido por Setor
            </h4>
            {kpis.porSetor.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum dado para exibir.</p>
            ) : (
                <div className="kpi-grid">
                    {kpis.porSetor.map((s, i) => (
                        <Card
                            key={s.setor}
                            value={fmtBRL(s.liquido)}
                            label={s.setor}
                            sub={`${s.qtd.toLocaleString('pt-BR')} registro(s)`}
                            icon={<Building2 className="w-6 h-6 text-white" />}
                            gradient={GRAD[i % GRAD.length]}
                        />
                    ))}
                </div>
            )}
        </div>
    </div>
);
