import React from 'react';
import {
    BadgeDollarSign,
    Clock3,
    Gift,
    HeartPulse,
    Percent,
    ReceiptText,
    TrendingUp,
    Users,
    Utensils,
    WalletCards,
} from 'lucide-react';
import type { FolhaKpiData } from '@/hooks/useFolhaPagamento';

const fmtBRL = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (value: number | null) =>
    value == null
        ? 'Sem base'
        : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

type Tone = 'blue' | 'green' | 'orange' | 'pink' | 'red';

const TONES: Record<Tone, { text: string; icon: string }> = {
    blue: { text: 'text-blue-400', icon: 'bg-blue-500' },
    green: { text: 'text-emerald-400', icon: 'bg-emerald-500' },
    orange: { text: 'text-amber-400', icon: 'bg-amber-500' },
    pink: { text: 'text-pink-400', icon: 'bg-pink-500' },
    red: { text: 'text-red-400', icon: 'bg-red-500' },
};

interface MetricCardProps {
    label: React.ReactNode;
    value: string;
    detail: React.ReactNode;
    icon: React.ReactNode;
    tone: Tone;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, detail, icon, tone }) => (
    <div className="rounded-lg border border-border bg-card p-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
                <p className={`mt-2 text-xl font-black ${TONES[tone].text}`}>{value}</p>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${TONES[tone].icon}`}>
                {icon}
            </div>
        </div>
        <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-sm font-bold uppercase text-foreground">{children}</h3>
);

interface Props {
    kpis: FolhaKpiData;
}

export const FolhaKPIs: React.FC<Props> = ({ kpis }) => {
    const evolutionTone: Tone = kpis.evolucaoMensal != null && kpis.evolucaoMensal > 0 ? 'red' : 'green';

    return (
        <div className="space-y-7">
            <section className="space-y-3">
                <SectionTitle>Indicadores Financeiros</SectionTitle>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                        label="Folha sobre Receita"
                        value={fmtPct(kpis.folhaSobreReceita)}
                        detail={`${fmtBRL(kpis.folhaTotal)} / ${fmtBRL(kpis.receitaLiquida)}`}
                        icon={<Percent className="h-5 w-5" />}
                        tone="blue"
                    />
                    <MetricCard
                        label={<>Encargos sobre Sal&aacute;rios</>}
                        value={fmtPct(kpis.encargosSobreSalarios)}
                        detail={`${fmtBRL(kpis.encargos)} / ${fmtBRL(kpis.salarios)}`}
                        icon={<ReceiptText className="h-5 w-5" />}
                        tone="orange"
                    />
                    <MetricCard
                        label={<>Custo M&eacute;dio por Colaborador</>}
                        value={fmtBRL(kpis.custoMedioColaborador)}
                        detail={`${kpis.colaboradores.toLocaleString('pt-BR')} colaborador(es)`}
                        icon={<Users className="h-5 w-5" />}
                        tone="green"
                    />
                    <MetricCard
                        label={<>Benef&iacute;cios sobre Folha</>}
                        value={fmtPct(kpis.beneficiosSobreFolha)}
                        detail={`${fmtBRL(kpis.beneficios)} / ${fmtBRL(kpis.folhaTotal)}`}
                        icon={<Gift className="h-5 w-5" />}
                        tone="pink"
                    />
                    <MetricCard
                        label={<>Evolu&ccedil;&atilde;o Mensal da Folha</>}
                        value={fmtPct(kpis.evolucaoMensal)}
                        detail={`M\u00eas anterior: ${fmtBRL(kpis.folhaMesAnterior)}`}
                        icon={<TrendingUp className="h-5 w-5" />}
                        tone={evolutionTone}
                    />
                </div>
            </section>

            <section className="space-y-3">
                <SectionTitle>Indicadores de Horas</SectionTitle>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MetricCard
                        label="Horas Extras"
                        value={fmtBRL(kpis.horasExtras)}
                        detail="Soma das horas extras de 50%, 60%, 70% e 100%"
                        icon={<Clock3 className="h-5 w-5" />}
                        tone="orange"
                    />
                    <MetricCard
                        label="Horas Extras sobre a Folha"
                        value={fmtPct(kpis.horasExtrasSobreFolha)}
                        detail={`${fmtBRL(kpis.horasExtras)} / ${fmtBRL(kpis.folhaTotal)}`}
                        icon={<Percent className="h-5 w-5" />}
                        tone="blue"
                    />
                    <MetricCard
                        label={<>M&eacute;dia por Colaborador</>}
                        value={fmtBRL(kpis.mediaHorasExtrasColaborador)}
                        detail={`${kpis.colaboradores.toLocaleString('pt-BR')} colaborador(es)`}
                        icon={<Users className="h-5 w-5" />}
                        tone="green"
                    />
                </div>
            </section>

            <section className="space-y-3">
                <SectionTitle>Indicadores de Benef&iacute;cios</SectionTitle>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                        label={<>Vale Alimenta&ccedil;&atilde;o</>}
                        value={fmtBRL(kpis.valeAlimentacao)}
                        detail={<>Pagamentos classificados como Alimenta&ccedil;&atilde;o</>}
                        icon={<Utensils className="h-5 w-5" />}
                        tone="green"
                    />
                    <MetricCard
                        label={<>Plano de Sa&uacute;de</>}
                        value={fmtBRL(kpis.planoSaude)}
                        detail={<>Pagamentos classificados como Plano de Sa&uacute;de</>}
                        icon={<HeartPulse className="h-5 w-5" />}
                        tone="pink"
                    />
                    <MetricCard
                        label={<>Premia&ccedil;&atilde;o</>}
                        value={fmtBRL(kpis.premiacao)}
                        detail={<>Total de pagamentos de premia&ccedil;&atilde;o</>}
                        icon={<BadgeDollarSign className="h-5 w-5" />}
                        tone="orange"
                    />
                    <MetricCard
                        label={<>Premia&ccedil;&atilde;o sobre Folha</>}
                        value={fmtPct(kpis.premiacaoSobreFolha)}
                        detail={`${fmtBRL(kpis.premiacao)} / ${fmtBRL(kpis.folhaTotal)}`}
                        icon={<Percent className="h-5 w-5" />}
                        tone="blue"
                    />
                    <MetricCard
                        label={<>Benef&iacute;cios por Colaborador</>}
                        value={fmtBRL(kpis.beneficiosPorColaborador)}
                        detail={`${fmtBRL(kpis.beneficios)} / ${kpis.colaboradores.toLocaleString('pt-BR')}`}
                        icon={<WalletCards className="h-5 w-5" />}
                        tone="green"
                    />
                </div>
            </section>
        </div>
    );
};
