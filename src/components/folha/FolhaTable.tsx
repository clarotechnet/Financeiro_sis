import React, { useMemo, useState } from 'react';
import type { DadoFinanceiro } from '@/hooks/useFolhaPagamento';

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

const DETAIL_FIELDS: { label: string; field: keyof DadoFinanceiro }[] = [
    { label: 'Sal. Folha', field: 'sal_folha' },
    { label: 'PERICULOSIDADE', field: 'periculosidade' },
    { label: 'I.N.S.S.', field: 'inss' },
    { label: 'Total proventos', field: 'total_proventos' },
    { label: 'Total descontos', field: 'total_descontos' },
    { label: 'Líquido', field: 'salario_liquido' },
];

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

    const totalLiquido = useMemo(
        () => filtered.reduce((total, row) => total + (Number(row.salario_liquido) || 0), 0),
        [filtered],
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <div className="card" style={{ overflow: 'hidden' }}>
            <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                <h3 className="text-lg font-bold text-foreground">
                    Dados Detalhados <span className="text-sm text-muted-foreground font-normal">({filtered.length})</span>
                </h3>
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            L&iacute;quido dos registros
                        </p>
                        <p className="text-base font-extrabold text-emerald-500">{fmtMoney(totalLiquido)}</p>
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar CPF ..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(0); }}
                        className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground w-72"
                    />
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-foreground">
                        <tr>
                            <th className="px-3 py-2 text-left whitespace-nowrap">Data</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">Nome</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">CPF</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">Setor</th>
                            {DETAIL_FIELDS.map(item => (
                                <th key={item.field} className="px-3 py-2 text-right whitespace-nowrap">
                                    {item.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pageData.map(r => (
                            <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.data)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{r.nome}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{fmtCPF(r.cpf)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{r.setor_nome || r.setor || '-'}</td>
                                {DETAIL_FIELDS.map(item => {
                                    const value = Number(r[item.field]) || 0;
                                    const valueClass = item.field === 'total_descontos'
                                        ? 'text-destructive'
                                        : item.field === 'total_proventos'
                                            ? 'text-emerald-500'
                                            : item.field === 'salario_liquido'
                                                ? 'font-bold'
                                                : value === 0
                                                    ? 'text-muted-foreground/60'
                                                    : '';
                                    return (
                                        <td key={item.field} className={`px-3 py-2 text-right whitespace-nowrap ${valueClass}`}>
                                            {fmtMoney(value)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {pageData.length === 0 && (
                            <tr><td colSpan={DETAIL_FIELDS.length + 4} className="px-3 py-8 text-center text-muted-foreground">
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
