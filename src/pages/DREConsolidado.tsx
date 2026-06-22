import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileBarChart, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/comissionamento/LoadingSpinner';
import { useComissionamento } from '@/hooks/useComissionamento';
import { useFolhaPagamento } from '@/hooks/useFolhaPagamento';
import type { LancamentoPix } from '@/types/comissionamento';
import type { DadoFinanceiro } from '@/hooks/useFolhaPagamento';

interface LinhaDRE {
    origem: 'PIX' | 'Folha';
    local: string;   // unidade (PIX) ou setor (Folha)
    servico: string; // categoria (PIX) ou "Salários" (Folha)
    valor: number;
}

const fmtBRL = (n: number) =>
    (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMesAno = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '-';
    const mes = d.toLocaleDateString('pt-BR', { month: 'long' });
    const ano = d.toLocaleDateString('pt-BR', { year: '2-digit' });
    return `${mes.charAt(0).toUpperCase()}${mes.slice(1)}/${ano}`;
};

interface MultiSelectProps {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const toggle = (opt: string) =>
        selected.includes(opt) ? onChange(selected.filter(s => s !== opt)) : onChange([...selected, opt]);
    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
    return (
        <div className="form-group" ref={ref} style={{ zIndex: isOpen ? 50 : 1, position: 'relative' }}>
            <Label className="form-label">{label}</Label>
            <div className="multi-select">
                <div className={`multi-select-button ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
                    <span className="multi-select-text">
                        {selected.length === 0 ? 'Todos' : `${selected.length} selecionado(s)`}
                    </span>
                    {selected.length > 0 && <span className="selected-count">{selected.length}</span>}
                    <span className={`multi-select-arrow ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </div>
                {isOpen && (
                    <div className="multi-select-dropdown open">
                        <input
                            type="text"
                            className="w-full px-3 py-2 text-sm border-b border-border bg-background text-foreground outline-none placeholder:text-muted-foreground"
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                        {filtered.map(opt => (
                            <div key={opt} className="multi-select-option" onClick={() => toggle(opt)}>
                                <div className={`multi-select-checkbox ${selected.includes(opt) ? 'checked' : ''}`} />
                                <span>{opt}</span>
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const DREConsolidado: React.FC = () => {
    const com = useComissionamento();
    const folha = useFolhaPagamento();

    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [setores, setSetores] = useState<string[]>([]);
    const [servicos, setServicos] = useState<string[]>([]);

    useEffect(() => {
        com.fetchData();
        folha.fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isLoading = com.isLoading || folha.isLoading;

    const opcoesSetor = useMemo(() => {
        const pix = com.uniqueCidades.map(u => u.toUpperCase());
        const f = folha.opcoesCategoria.map(s => s.toUpperCase());
        return [...new Set([...pix, ...f])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [com.uniqueCidades, folha.opcoesCategoria]);

    const opcoesServico = useMemo(() => {
        const pix = [...com.uniqueFrente];
        const f = ['Salários'];
        return [...new Set([...pix, ...f])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [com.uniqueFrente]);

    const [detalhe, setDetalhe] = useState<{
        origem: 'PIX' | 'Folha';
        local: string;
        servico: string;
        pix: LancamentoPix[];
        folha: DadoFinanceiro[];
    } | null>(null);

    const filtrados = useMemo(() => {
        const pix = com.allData.filter(r => {
            if (dataInicio && (!r.data_lancamento || r.data_lancamento < dataInicio)) return false;
            if (dataFim && (!r.data_lancamento || r.data_lancamento > dataFim)) return false;

            const local = (r.unidade || 'Sem Unidade').toUpperCase();
            const servico = r.categoria || 'Sem Categoria';

            if (setores.length > 0 && !setores.includes(local)) return false;
            if (servicos.length > 0 && !servicos.includes(servico)) return false;
            return true;
        });
        const fol = folha.allData.filter(r => {
            if (dataInicio && (!r.data || r.data < dataInicio)) return false;
            if (dataFim && (!r.data || r.data > dataFim)) return false;

            const local = (r.setor || 'Sem Setor').toUpperCase();
            const servico = 'Salários';

            if (setores.length > 0 && !setores.includes(local)) return false;
            if (servicos.length > 0 && !servicos.includes('Salários')) return false;
            return true;
        });
        return { pix, fol };
    }, [com.allData, folha.allData, dataInicio, dataFim, setores, servicos]);

    type Grupo = {
        origem: 'PIX' | 'Folha';
        local: string;
        servico: string;
        valor: number;
        qtd: number;
        pix: LancamentoPix[];
        folha: DadoFinanceiro[];
    };

    const periodoDoGrupo = (a: Grupo) => {
        if (a.pix.length > 0) return fmtMesAno(a.pix[0].data_lancamento || '');
        if (a.folha.length > 0) return fmtMesAno(a.folha[0].data || '');
        return '-';
    };

    const agrupado = useMemo<Grupo[]>(() => {
        const map = new Map<string, Grupo>();
        filtrados.pix.forEach(r => {
            const local = (r.unidade || 'Sem Unidade').toUpperCase();
            const servico = r.categoria || 'Sem Categoria';
            const k = `PIX||${local}||${servico}`;
            if (!map.has(k)) map.set(k, { origem: 'PIX', local, servico, valor: 0, qtd: 0, pix: [], folha: [] });
            const g = map.get(k)!;
            g.valor += Number(r.valor) || 0;
            g.qtd += 1;
            g.pix.push(r);
        });
        filtrados.fol.forEach(r => {
            const local = (r.setor || 'Sem Setor').toUpperCase();
            const servico = 'Salários';
            const k = `Folha||${local}||${servico}`;
            if (!map.has(k)) map.set(k, { origem: 'Folha', local, servico, valor: 0, qtd: 0, pix: [], folha: [] });
            const g = map.get(k)!;
            g.valor += Number(r.salario_liquido) || 0;
            g.qtd += 1;
            g.folha.push(r);
        });
        return Array.from(map.values()).sort((a, b) =>
            a.local.localeCompare(b.local, 'pt-BR') ||
            a.servico.localeCompare(b.servico, 'pt-BR')
        );
    }, [filtrados]);

    const totais = useMemo(() => {
        const pix = agrupado.filter(a => a.origem === 'PIX').reduce((s, a) => s + a.valor, 0);
        const folhaT = agrupado.filter(a => a.origem === 'Folha').reduce((s, a) => s + a.valor, 0);
        return { pix, folha: folhaT, total: pix + folhaT };
    }, [agrupado]);

    const handleExportExcel = () => {
        if (agrupado.length === 0) return alert('Sem dados.');
        const rows = agrupado.map(a => ({
            Origem: a.origem,
            Local: a.local,
            Serviço: a.servico,
            Período: periodoDoGrupo(a),
            'Qtd Lançamentos': a.qtd,
            Valor: a.valor,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Consolidado');
        XLSX.writeFile(wb, `consolidado_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleGerarDRE = () => {
        if (agrupado.length === 0) return alert('Sem dados.');

        const linhasDRE: any[] = [];
        linhasDRE.push({ Descrição: 'DRE CONSOLIDADO', Valor: '', Período: '' });
        linhasDRE.push({ Descrição: `Período: ${dataInicio || '—'} a ${dataFim || '—'}`, Valor: '', Período: '' });
        if (setores.length) linhasDRE.push({ Descrição: `Setores: ${setores.join(', ')}`, Valor: '', Período: '' });
        if (servicos.length) linhasDRE.push({ Descrição: `Serviços: ${servicos.join(', ')}`, Valor: '', Período: '' });
        linhasDRE.push({ Descrição: '', Valor: '', Período: '' });

        // PIX por categoria/local
        linhasDRE.push({ Descrição: '(-) PAGAMENTOS PIX (Comissionamento)', Valor: '', Período: '' });
        agrupado
            .filter(a => a.origem === 'PIX')
            .forEach(a => linhasDRE.push({
                Descrição: `   ${a.local} - ${a.servico}`,
                Valor: -a.valor,
                Período: periodoDoGrupo(a),
            }));
        linhasDRE.push({ Descrição: '', Valor: '', Período: '' });

        // Folha por setor
        linhasDRE.push({ Descrição: '(-) FOLHA DE PAGAMENTO (Salários por Setor)', Valor: '', Período: '' });
        agrupado
            .filter(a => a.origem === 'Folha')
            .forEach(a => linhasDRE.push({
                Descrição: `   ${a.local} - Salários`,
                Valor: -a.valor,
                Período: periodoDoGrupo(a),
            }));
        linhasDRE.push({ Descrição: '', Valor: '', Período: '' });

        linhasDRE.push({ Descrição: 'TOTAL DESPESAS', Valor: -totais.total, Período: '' });

        const ws = XLSX.utils.json_to_sheet(linhasDRE, { header: ['Descrição', 'Valor', 'Período'] });
        ws['!cols'] = [{ wch: 60 }, { wch: 20 }, { wch: 15 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'DRE');
        // Aba: Detalhamento Folha (com verbas)
        const verbaCols: { label: string; field: keyof DadoFinanceiro }[] = [
            { label: 'Férias', field: 'ferias' },
            { label: '13° Salário', field: 'decimo_terceiro' },
            { label: 'Periculosidade', field: 'periculosidade' },
            { label: 'Hora extra 50%', field: 'hora_extra_50' },
            { label: 'Hora extra 60%', field: 'hora_extra_60' },
            { label: 'Hora extra 70%', field: 'hora_extra_70' },
            { label: 'Hora extra 100%', field: 'hora_extra_100' },
            { label: 'DSR', field: 'dsr' },
            { label: 'Sal. Maternidade', field: 'sal_maternidade' },
            { label: 'Vale transporte', field: 'vale_transporte' },
            { label: 'Desc plano saúde', field: 'desc_plano_saude' },
            { label: 'Desc odonto', field: 'desc_odonto' },
            { label: 'Desc faltas', field: 'desc_faltas' },
            { label: 'Desc adiantamento', field: 'desc_adiantamento' },
            { label: 'Contribuição', field: 'contribuicao' },
            { label: 'Desc Pensão', field: 'desc_pensao' },
            { label: 'Dif. Salário', field: 'dif_salario' },
            { label: 'Empréstimo', field: 'emprestimo' },
            { label: 'Desc fardamento', field: 'desc_fardamento' },
        ];

        if (filtrados.fol.length > 0) {
            const detRows = filtrados.fol.map(r => {
                const row: Record<string, any> = {
                    Data: fmtMesAno(r.data || ''),
                    Nome: r.nome,
                    CPF: r.cpf,
                    Setor: r.setor || '',
                    Proventos: Number(r.total_proventos) || 0,
                    Descontos: Number(r.total_descontos) || 0,
                    Líquido: Number(r.salario_liquido) || 0,
                };
                verbaCols.forEach(v => { row[v.label] = Number(r[v.field]) || 0; });
                return row;
            });
            const header = ['Data', 'Nome', 'CPF', 'Setor', 'Proventos', 'Descontos', 'Líquido', ...verbaCols.map(v => v.label)];
            const ws2 = XLSX.utils.json_to_sheet(detRows, { header });
            ws2['!cols'] = header.map(h => ({ wch: h === 'Nome' ? 30 : h === 'Setor' ? 25 : 15 }));
            XLSX.utils.book_append_sheet(wb, ws2, 'Detalhamento Folha');
        }
        XLSX.writeFile(wb, `DRE_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const refresh = () => {
        com.fetchData();
        folha.fetchData();
    };
    const limpar = () => {
        setDataInicio('');
        setDataFim('');
        setSetores([]);
        setServicos([]);
    };

    return (
        <div className="min-h-full">
            <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-glow"
                        style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                        <FileBarChart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-extrabold text-foreground">DRE Consolidado</h1>
                        <p className="text-sm text-muted-foreground">Junção de PIX (Comissionamento) + Folha de Pagamento</p>
                    </div>
                </div>

                <div className="card" style={{ position: 'relative', zIndex: 10 }}>
                    <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                        <h3 className="text-lg font-bold text-foreground">Filtros</h3>
                        <div className="flex items-center gap-3 flex-wrap">
                            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1">
                                <Download className="w-4 h-4" /> Exportar Excel
                            </Button>
                            <Button size="sm" onClick={handleGerarDRE} className="gap-1">
                                <FileSpreadsheet className="w-4 h-4" /> Gerar DRE
                            </Button>
                            <Button variant="outline" size="sm" onClick={refresh} className="gap-1">
                                <RefreshCw className="w-4 h-4" /> Atualizar
                            </Button>
                            <Button variant="outline" size="sm" onClick={limpar}>
                                Limpar
                            </Button>
                        </div>
                    </div>
                    <div className="filter-section">
                        <div className="form-group">
                            <Label className="form-label">Data Inicial</Label>
                            <input type="date"
                                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                                value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <Label className="form-label">Data Final</Label>
                            <input type="date"
                                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                                value={dataFim} onChange={e => setDataFim(e.target.value)} />
                        </div>
                        <MultiSelect
                            label="Setor / Unidade"
                            options={opcoesSetor}
                            selected={setores}
                            onChange={setSetores}
                        />
                        <MultiSelect
                            label="Serviço"
                            options={opcoesServico}
                            selected={servicos}
                            onChange={setServicos}
                        />
                    </div>
                </div>

                {isLoading ? <LoadingSpinner /> : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="card">
                                <div className="text-xs text-muted-foreground">PIX (Comissionamento)</div>
                                <div className="text-xl font-extrabold text-foreground mt-1">{fmtBRL(totais.pix)}</div>
                            </div>
                            <div className="card">
                                <div className="text-xs text-muted-foreground">Folha (Salários)</div>
                                <div className="text-xl font-extrabold text-foreground mt-1">{fmtBRL(totais.folha)}</div>
                            </div>
                            <div className="card">
                                <div className="text-xs text-muted-foreground">Total Consolidado</div>
                                <div className="text-xl font-extrabold text-primary mt-1">{fmtBRL(totais.total)}</div>
                            </div>
                        </div>

                        <div className="card">
                            <h3 className="text-lg font-bold text-foreground mb-3">Detalhamento por Local e Serviço</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-left text-muted-foreground">
                                            <th className="py-2 px-2">Origem</th>
                                            <th className="py-2 px-2">Local / Setor</th>
                                            <th className="py-2 px-2">Serviço</th>
                                            <th className="py-2 px-2">Período</th>
                                            <th className="py-2 px-2 text-right">Qtd</th>
                                            <th className="py-2 px-2 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agrupado.map((a, i) => (
                                            <tr
                                                key={i}
                                                className="border-b border-border/40 hover:bg-muted/30 cursor-pointer"
                                                onClick={() => setDetalhe({
                                                    origem: a.origem, local: a.local, servico: a.servico,
                                                    pix: a.pix, folha: a.folha,
                                                })}
                                                title="Clique para ver os lançamentos"
                                            >
                                                <td className="py-2 px-2">
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${a.origem === 'PIX' ? 'bg-blue-500/15 text-blue-500' : 'bg-emerald-500/15 text-emerald-500'
                                                        }`}>{a.origem}</span>
                                                </td>
                                                <td className="py-2 px-2 font-medium text-foreground">{a.local}</td>
                                                <td className="py-2 px-2 text-foreground">{a.servico}</td>
                                                <td className="py-2 px-2 text-foreground">{periodoDoGrupo(a)}</td>
                                                <td className="py-2 px-2 text-right text-primary underline-offset-2 hover:underline">{a.qtd}</td>
                                                <td className="py-2 px-2 text-right font-semibold text-foreground">{fmtBRL(a.valor)}</td>
                                            </tr>
                                        ))}
                                        {agrupado.length === 0 && (
                                            <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Sem dados no período.</td></tr>
                                        )}
                                    </tbody>
                                    {agrupado.length > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-border font-bold">
                                                <td colSpan={5} className="py-3 px-2 text-right">TOTAL</td>
                                                <td className="py-3 px-2 text-right text-primary">{fmtBRL(totais.total)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
            <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            {detalhe?.origem} — {detalhe?.local} / {detalhe?.servico}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="overflow-auto flex-1">
                        {detalhe?.origem === 'PIX' && (
                            <table className="w-full text-xs">
                                <thead className="bg-muted/40 sticky top-0">
                                    <tr className="text-left">
                                        <th className="px-2 py-2">Data</th>
                                        <th className="px-2 py-2">Favorecido</th>
                                        <th className="px-2 py-2">Descrição</th>
                                        <th className="px-2 py-2">Centro de Custo</th>
                                        <th className="px-2 py-2 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detalhe.pix.map((r, i) => (
                                        <tr key={i} className="border-t border-border/40">
                                            <td className="px-2 py-1.5 whitespace-nowrap">{fmtMesAno(r.data_lancamento || '')}</td>
                                            <td className="px-2 py-1.5">{r.favorecido}</td>
                                            <td className="px-2 py-1.5">{r.descricao || '-'}</td>
                                            <td className="px-2 py-1.5">{r.centro_de_custo || '-'}</td>
                                            <td className="px-2 py-1.5 text-right font-semibold">{fmtBRL(Number(r.valor) || 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-border font-bold">
                                        <td colSpan={4} className="px-2 py-2 text-right">Total ({detalhe.pix.length})</td>
                                        <td className="px-2 py-2 text-right text-primary">
                                            {fmtBRL(detalhe.pix.reduce((s, r) => s + (Number(r.valor) || 0), 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                        {detalhe?.origem === 'Folha' && (
                            <table className="w-full text-xs">
                                <thead className="bg-muted/40 sticky top-0">
                                    <tr className="text-left">
                                        <th className="px-2 py-2">Data</th>
                                        <th className="px-2 py-2">Nome</th>
                                        <th className="px-2 py-2">CPF</th>
                                        <th className="px-2 py-2">Setor</th>
                                        <th className="px-2 py-2 text-right">Proventos</th>
                                        <th className="px-2 py-2 text-right">Descontos</th>
                                        <th className="px-2 py-2 text-right">Líquido</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detalhe.folha.map((r, i) => (
                                        <tr key={i} className="border-t border-border/40">
                                            <td className="px-2 py-1.5 whitespace-nowrap">{fmtMesAno(r.data || '')}</td>
                                            <td className="px-2 py-1.5">{r.nome}</td>
                                            <td className="px-2 py-1.5">{r.cpf}</td>
                                            <td className="px-2 py-1.5">{r.setor || '-'}</td>
                                            <td className="px-2 py-1.5 text-right text-emerald-500">{fmtBRL(r.total_proventos)}</td>
                                            <td className="px-2 py-1.5 text-right text-destructive">{fmtBRL(r.total_descontos)}</td>
                                            <td className="px-2 py-1.5 text-right font-semibold">{fmtBRL(r.salario_liquido)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-border font-bold">
                                        <td colSpan={6} className="px-2 py-2 text-right">Total ({detalhe.folha.length})</td>
                                        <td className="px-2 py-2 text-right text-primary">
                                            {fmtBRL(detalhe.folha.reduce((s, r) => s + (Number(r.salario_liquido) || 0), 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DREConsolidado;