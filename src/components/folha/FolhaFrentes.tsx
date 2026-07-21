import React from 'react';
import { ArrowDownRight, ArrowUpRight, Building2, Minus, Users } from 'lucide-react';
import type { FolhaUnidadeDetalhe } from '@/hooks/useFolhaPagamento';

const fmtBRL = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPct = (value: number) =>
    `${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const ResultValue: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => (
    <span className={`${value >= 0 ? 'text-emerald-400' : 'text-red-400'} ${className}`}>{fmtBRL(value)}</span>
);

const VariationBadge: React.FC<{ value: number | null }> = ({ value }) => {
    if (value == null) {
        return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> Sem base anterior</span>;
    }

    const positive = value >= 0;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {fmtPct(value)} vs. m&ecirc;s anterior
        </span>
    );
};

interface Props {
    unidades: FolhaUnidadeDetalhe[];
}

export const FolhaFrentes: React.FC<Props> = ({ unidades }) => {
    if (unidades.length === 0) {
        return <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">Nenhum centro de custo encontrado.</div>;
    }

    return (
        <div className="space-y-10">
            {unidades.map(unidade => (
                <section key={unidade.unidade} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                        <h3 className="flex items-center gap-2 text-lg font-extrabold text-foreground">
                            <Building2 className="h-5 w-5 text-accent" />
                            {unidade.unidade}
                        </h3>
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" /> {unidade.colaboradores.toLocaleString('pt-BR')} colaborador(es)
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4 xl:grid-cols-7">
                        <SummaryItem label="Valor Total" value={fmtBRL(unidade.movimentacao)} />
                        <SummaryItem label="Receitas" value={fmtBRL(unidade.receitas)} tone="positive" />
                        <SummaryItem label="Despesas" value={fmtBRL(unidade.despesas)} tone="negative" />
                        <SummaryItem label="Resultado" value={<ResultValue value={unidade.resultado} />} />
                        <SummaryItem label={<>Varia&ccedil;&atilde;o</>} value={<VariationBadge value={unidade.variacaoResultado} />} />
                        <SummaryItem label="Receita / Colab." value={fmtBRL(unidade.mediaReceitasColaborador)} />
                        <SummaryItem label="Despesa / Colab." value={fmtBRL(unidade.mediaDespesasColaborador)} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {unidade.centros.map(centro => (
                            <article key={centro.centro} className="rounded-lg border border-border bg-card p-4">
                                <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                                    <h4 className="min-w-0 text-sm font-bold text-foreground" title={centro.centro}>{centro.centro}</h4>
                                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                                        <Users className="h-3.5 w-3.5" /> {centro.colaboradores}
                                    </span>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <CenterMetric label="Valor Total" value={fmtBRL(centro.movimentacao)} />
                                    <CenterMetric label="Resultado" value={<ResultValue value={centro.resultado} className="font-extrabold" />} />
                                    <CenterMetric label="Receitas" value={fmtBRL(centro.receitas)} valueClass="text-emerald-400" />
                                    <CenterMetric label="Despesas" value={fmtBRL(centro.despesas)} valueClass="text-red-400" />
                                </div>

                                <div className="mt-3 border-t border-border pt-3">
                                    <VariationBadge value={centro.variacaoResultado} />
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
                                    <CenterMetric label="Receita / Colab." value={fmtBRL(centro.mediaReceitasColaborador)} compact />
                                    <CenterMetric label="Despesa / Colab." value={fmtBRL(centro.mediaDespesasColaborador)} compact />
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

interface SummaryItemProps {
    label: React.ReactNode;
    value: React.ReactNode;
    tone?: 'positive' | 'negative';
}

const SummaryItem: React.FC<SummaryItemProps> = ({ label, value, tone }) => (
    <div className="min-w-0 bg-card px-3 py-3">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
        <div className={`mt-1 break-words text-sm font-extrabold ${tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-red-400' : 'text-foreground'}`}>
            {value}
        </div>
    </div>
);

interface CenterMetricProps {
    label: string;
    value: React.ReactNode;
    valueClass?: string;
    compact?: boolean;
}

const CenterMetric: React.FC<CenterMetricProps> = ({ label, value, valueClass = 'text-foreground', compact = false }) => (
    <div className="min-w-0">
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
        <div className={`${compact ? 'text-xs' : 'text-sm'} mt-0.5 break-words font-bold ${valueClass}`}>{value}</div>
    </div>
);
