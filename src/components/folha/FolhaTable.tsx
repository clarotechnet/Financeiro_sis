import React, { useEffect, useMemo, useState } from 'react';
import { ListChecks, Loader2, Trash2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { DadoFinanceiro } from '@/hooks/useFolhaPagamento';

interface Props {
    data: DadoFinanceiro[];
    canDelete: boolean;
    isDeleting: boolean;
    onDeleteSelected: (ids: string[]) => Promise<number>;
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

export const FolhaTable: React.FC<Props> = ({ data, canDelete, isDeleting, onDeleteSelected }) => {
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
    const pageIds = pageData.map(row => row.id);
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    const somePageSelected = pageIds.some(id => selectedIds.has(id));

    useEffect(() => {
        setPage(current => Math.min(current, totalPages - 1));
    }, [totalPages]);

    useEffect(() => {
        const availableIds = new Set(filtered.map(row => row.id));
        setSelectedIds(previous => new Set(Array.from(previous).filter(id => availableIds.has(id))));
    }, [filtered]);

    const togglePageSelection = (selected: boolean) => {
        setSelectedIds(previous => {
            const next = new Set(previous);
            pageIds.forEach(id => {
                if (selected) next.add(id);
                else next.delete(id);
            });
            return next;
        });
    };

    const toggleRowSelection = (id: string, selected: boolean) => {
        setSelectedIds(previous => {
            const next = new Set(previous);
            if (selected) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleDeleteSelected = async () => {
        try {
            const deleted = await onDeleteSelected(Array.from(selectedIds));
            setSelectedIds(new Set());
            setSelectionMode(false);
            setDeleteConfirmOpen(false);
            toast({
                title: 'Registros excluídos',
                description: `${deleted} registro(s) da folha foram excluídos.`,
            });
        } catch (deleteError: any) {
            setDeleteConfirmOpen(false);
            toast({
                title: 'Não foi possível excluir',
                description: deleteError.message || 'Confira sua permissão e tente novamente.',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="card" style={{ overflow: 'hidden' }}>
            <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                <h3 className="text-lg font-bold text-foreground">
                    Dados Detalhados <span className="text-sm text-muted-foreground font-normal">({filtered.length})</span>
                </h3>
                <div className="flex flex-wrap items-center justify-end gap-3">
                    {canDelete && (
                        <>
                            <Button
                                variant={selectionMode ? 'secondary' : 'outline'}
                                size="sm"
                                className="gap-1"
                                disabled={isDeleting || filtered.length === 0}
                                onClick={() => {
                                    setSelectionMode(previous => !previous);
                                    setSelectedIds(new Set());
                                }}
                            >
                                <ListChecks className="w-4 h-4" />
                                {selectionMode ? 'Cancelar seleção' : 'Selecionar'}
                            </Button>
                            {selectionMode && selectedIds.size > 0 && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="gap-1"
                                    disabled={isDeleting}
                                    onClick={() => setDeleteConfirmOpen(true)}
                                >
                                    {isDeleting
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Trash2 className="w-4 h-4" />}
                                    Excluir selecionados ({selectedIds.size})
                                </Button>
                            )}
                        </>
                    )}
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
                            {canDelete && selectionMode && (
                                <th className="w-10 px-3 py-2 text-left">
                                    <Checkbox
                                        checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                                        onCheckedChange={checked => togglePageSelection(checked === true)}
                                        aria-label="Selecionar registros desta página"
                                    />
                                </th>
                            )}
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
                                {canDelete && selectionMode && (
                                    <td className="px-3 py-2">
                                        <Checkbox
                                            checked={selectedIds.has(r.id)}
                                            onCheckedChange={checked => toggleRowSelection(r.id, checked === true)}
                                            aria-label={`Selecionar registro de ${r.nome}`}
                                        />
                                    </td>
                                )}
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
                            <tr><td colSpan={DETAIL_FIELDS.length + 4 + (canDelete && selectionMode ? 1 : 0)} className="px-3 py-8 text-center text-muted-foreground">
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

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir registros selecionados?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {selectedIds.size} registro(s) serão removidos definitivamente da Folha de Pagamento.
                            Os lançamentos já importados em Pagamentos não serão alterados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isDeleting}
                            onClick={event => {
                                event.preventDefault();
                                handleDeleteSelected();
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? 'Excluindo...' : 'Excluir'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default FolhaTable;
