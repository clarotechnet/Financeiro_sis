import React, { useMemo, useState } from 'react';
import type { DadoFinanceiro } from '@/hooks/useFolhaPagamento';
import { VERBA_FIELDS } from '@/hooks/useFolhaPagamento';

interface Props {
    data: DadoFinanceiro[];
}

const fmtMoney = (v: number) =>
    (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtCPF = (cpf: string) => {
    const d = (cpf || '').replace(/\D/g, '').padStart(11, '0').slice(-11);
    if (d.length !== 11) return cpf;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const fmtDate = (s: string) => {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
};

const PAGE_SIZE = 50;

export const FolhaTable: React.FC<Props> = ({ data }) => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return data;
        return data.filter(r =>
            (r.nome || '').toLowerCase().includes(q) ||
            (r.cpf || '').includes(q.replace(/\D/g, '')) ||
            (r.setor || '').toLowerCase().includes(q)
        );
    }, [data, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <div className="card" style={{ overflow: 'hidden' }}>
            <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                <h3 className="text-lg font-bold text-foreground">
                    Dados Detalhados <span className="text-sm text-muted-foreground font-normal">({filtered.length})</span>
                </h3>
                <input
                    type="text"
                    placeholder="Buscar CPF ..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground w-72"
                />
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-foreground">
                        <tr>
                            <th className="px-3 py-2 text-left whitespace-nowrap">Data</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">Nome</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">CPF</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">Setor</th>
                            {VERBA_FIELDS.map(v => (
                                <th key={v.field} className="px-3 py-2 text-right whitespace-nowrap">{v.label}</th>
                            ))}
                            <th className="px-3 py-2 text-right whitespace-nowrap">T. Proventos</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap">T. Descontos</th>
                            <th className="px-3 py-2 text-right whitespace-nowrap font-bold">Líquido</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageData.map(r => (
                            <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.data)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{r.nome}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{fmtCPF(r.cpf)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{r.setor || '-'}</td>
                                {VERBA_FIELDS.map(v => {
                                    const n = Number(r[v.field]) || 0;
                                    return (
                                        <td key={v.field} className={`px-3 py-2 text-right whitespace-nowrap ${n === 0 ? 'text-muted-foreground/60' : ''}`}>
                                            {fmtMoney(n)}
                                        </td>
                                    );
                                })}
                                <td className="px-3 py-2 text-right whitespace-nowrap text-emerald-500">{fmtMoney(r.total_proventos)}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap text-destructive">{fmtMoney(r.total_descontos)}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap font-bold">{fmtMoney(r.salario_liquido)}</td>
                            </tr>
                        ))}
                        {pageData.length === 0 && (
                            <tr><td colSpan={VERBA_FIELDS.length + 7} className="px-3 py-8 text-center text-muted-foreground">
                                Nenhum registro encontrado.
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4 text-sm">
                    <span className="text-muted-foreground">
                        Página {page + 1} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded border border-border disabled:opacity-50"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >Anterior</button>
                        <button
                            className="px-3 py-1 rounded border border-border disabled:opacity-50"
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                        >Próxima</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FolhaTable;