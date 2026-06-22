import React from 'react';
import { Tags, Banknote, Users, TrendingUp, TrendingDown } from 'lucide-react';

const fmtBRL = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
    porSetor: { setor: string; qtd: number; liquido: number; proventos: number; descontos: number }[];
}

export const FolhaFrentes: React.FC<Props> = ({ porSetor }) => {
    const totalLiquido = porSetor.reduce((s, p) => s + p.liquido, 0);
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {porSetor.map(s => {
                const pct = totalLiquido > 0 ? (s.liquido / totalLiquido) * 100 : 0;
                return (
                    <div key={s.setor} className="card space-y-3">
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Tags className="w-4 h-4 text-accent" />
                            <span className="truncate" title={s.setor}>{s.setor}</span>
                        </h4>
                        <div>
                            <div className="text-xs text-muted-foreground">Salário Líquido</div>
                            <div className="text-2xl font-black text-accent">{fmtBRL(s.liquido)}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                            <div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="w-3 h-3" /> Reg.</div>
                                <div className="text-lg font-bold text-foreground">{s.qtd}</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> % Total</div>
                                <div className="text-lg font-bold" style={{ color: pct >= 10 ? '#22c55e' : '#f59e0b' }}>
                                    {pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Prov.</div>
                                <div className="text-sm font-bold text-emerald-500">{fmtBRL(s.proventos)}</div>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-border">
                            <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Descontos</div>
                            <div className="text-sm font-bold text-destructive">{fmtBRL(s.descontos)}</div>
                        </div>
                    </div>
                );
            })}
            {porSetor.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-6">Nenhum setor encontrado.</p>
            )}
        </div>
    );
};