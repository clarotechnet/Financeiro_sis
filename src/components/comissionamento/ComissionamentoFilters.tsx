import React, { useState, useRef, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { ComissionamentoFilters as FiltersType, LancamentoPix, OpcaoSelect } from '@/types/comissionamento';
import { X, FileEdit, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComissionamentoFormDialog } from './ComissionamentoFormDialog';
import { ComissionamentoImportExcel } from './ComissionamentoImportExcel';
import { useAuth } from '@/contexts/useAuth';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OpcoesData {
  cnpj: OpcaoSelect[];
  unidade: OpcaoSelect[];
  centro_de_custo: OpcaoSelect[];
  categoria: OpcaoSelect[];
  secao_custeio: OpcaoSelect[];
  centro_custeio: OpcaoSelect[];
  plano_contas: OpcaoSelect[];
  bancos: OpcaoSelect[];
}

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
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) onChange(selected.filter(s => s !== option));
    else onChange([...selected, option]);
  };

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="form-group" ref={ref} style={{ zIndex: isOpen ? 50 : 'auto', position: 'relative' }}>
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
            {filteredOptions.map(option => (
              <div key={option} className="multi-select-option" onClick={() => toggleOption(option)}>
                <div className={`multi-select-checkbox ${selected.includes(option) ? 'checked' : ''}`} />
                <span>{option}</span>
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface Props {
  filters: FiltersType;
  setFilters: (f: Partial<FiltersType>) => void;
  clearFilters: () => void;
  uniqueCidades: string[];
  uniqueNomes: string[];
  totalFiltered: number;
  onManualSubmit: (data: Record<string, any>) => Promise<void>;
  filteredData: LancamentoPix[];
  opcoes: OpcoesData;
  onImportExcel?: (rows: Record<string, any>[]) => Promise<{ inserted: number; skipped: number; errors: string[] }>;
}

export const ComissionamentoFilters: React.FC<Props> = ({
  filters, setFilters, clearFilters, uniqueCidades, uniqueNomes, totalFiltered,
  onManualSubmit, filteredData, opcoes, onImportExcel
}) => {
  const { isAdmin } = useAuth();
  const hasFilters = filters.cidade.length > 0 || filters.dataInicio || filters.dataFim
    || filters.nome.length > 0 || filters.contrato.length > 0
    || (filters.descricao && filters.descricao.trim().length > 0)
    || filters.contaAnalitica.length > 0 || filters.banco.length > 0
    || filters.status.length > 0;

  const [formOpen, setFormOpen] = useState(false);
  const statusOptions = ['PAGO', 'A PAGAR'];

  const uniqueCentroCusto = React.useMemo(
    () => opcoes.centro_de_custo.map(option => option.nome).filter(Boolean).sort(),
    [opcoes.centro_de_custo]
  );

  const uniqueBancos = React.useMemo(
    () => opcoes.bancos.map(option => option.nome).filter(Boolean).sort(),
    [opcoes.bancos]
  );

  const uniqueContasAnaliticas = React.useMemo(
    () => [...new Set(filteredData.map(r => r.conta_analitica).filter(Boolean))].sort() as string[],
    [filteredData]
  );

  const handleExportExcel = () => {
    const fmtDate = (val: string | null) => {
      if (!val) return '';
      const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : val;
    };
    const exportRows = filteredData.map(r => ({
      'Data': fmtDate(r.data_lancamento),
      'Nome': r.nome || '',
      'Favorecido': r.favorecido || '',
      'Chave PIX': r.chave_pix || '',
      'CNPJ': r.cnpj || '',
      'Unidade': r.unidade || '',
      'Centro de Custo': r.centro_de_custo || '',
      'Seção de Custeio': r.secao_custeio || '',
      'Conta Analítica': r.conta_analitica || '',
      'Observação': r.descricao || '',
      'Banco': r.banco || '',
      'Valor': r.valor ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lancamentos PIX');
    XLSX.writeFile(wb, 'lancamentos_pix.xlsx');
  };
  const handleGerarDRE = () => {
    const fmtBRL = (v: number) =>
      `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Agrupa despesas por conta analítica
    const map = new Map<string, { qtd: number; valor: number }>();
    let totalDespesas = 0;
    filteredData.forEach(r => {
      const k = r.conta_analitica || 'Sem Conta Analítica';
      if (!map.has(k)) map.set(k, { qtd: 0, valor: 0 });
      const it = map.get(k)!;
      it.qtd += 1;
      it.valor += r.valor || 0;
      totalDespesas += r.valor || 0;
    });
    const linhas = Array.from(map.entries())
      .map(([conta, v]) => ({ conta, qtd: v.qtd, valor: v.valor, pct: totalDespesas > 0 ? (v.valor / totalDespesas) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);

    // Período (a partir dos filtros ou do range dos dados)
    const datas = filteredData.map(r => r.data_lancamento).filter(Boolean) as string[];
    const minData = filters.dataInicio || (datas.length ? datas.reduce((a, b) => a < b ? a : b) : '');
    const maxData = filters.dataFim || (datas.length ? datas.reduce((a, b) => a > b ? a : b) : '');
    const fmtD = (s: string) => {
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
    };

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    // DRE NOmes
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Demonstração do Resultado do Exercício (DRE)', pageW / 2, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodo = minData && maxData
      ? `Período: ${fmtD(minData)} a ${fmtD(maxData)}`
      : 'Período: todos os lançamentos';
    doc.text(periodo, pageW / 2, 26, { align: 'center' });
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW / 2, 32, { align: 'center' });

    // Receita Bruta (placeholder - aba futura)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('(+) Receita Bruta', 14, 44);
    doc.setFont('helvetica', 'normal');
    doc.text('R$ 0,00', pageW - 14, 44, { align: 'right' });
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Aguardando aba de Receitas (a ser adicionada)', 14, 49);
    doc.setTextColor(0);

    // Despesas detalhadas
    autoTable(doc, {
      startY: 56,
      head: [['(-) Despesas por Conta Analítica', 'Qtd', 'Valor (R$)', '% Despesas']],
      body: linhas.map(l => [
        l.conta,
        String(l.qtd),
        fmtBRL(l.valor),
        `${l.pct.toFixed(2)}%`,
      ]),
      foot: [[
        'TOTAL DE DESPESAS',
        String(filteredData.length),
        fmtBRL(totalDespesas),
        '100,00%',
      ]],
      theme: 'striped',
      headStyles: { fillColor: [220, 53, 69], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    });

    // Resultado
    // @ts-expect-error - lastAutoTable is added by jspdf-autotable at runtime
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('(=) Resultado do Exercício', 14, finalY);
    doc.setTextColor(220, 53, 69);
    doc.text(`-${fmtBRL(totalDespesas)}`, pageW - 14, finalY, { align: 'right' });
    doc.setTextColor(0);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text(
      'Observação: este DRE considera apenas despesas. As receitas serão integradas em versão futura.',
      14, finalY + 8
    );

    doc.save(`DRE_${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  return (
    <div className="card relative z-20">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <h3 className="text-lg font-bold text-foreground">Filtros</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)} className="gap-1">
            <FileEdit className="w-4 h-4" /> Novo Lançamento
          </Button>
          {isAdmin && (
            <>
              {onImportExcel && <ComissionamentoImportExcel onImport={onImportExcel} />}
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={filteredData.length === 0} className="gap-1">
                <Download className="w-4 h-4" /> Exportar Excel
              </Button>
              {/* <Button
                variant="outline"
                size="sm"
                onClick={handleGerarDRE}
                disabled={filteredData.length === 0}
                className="gap-1 border-accent/40 text-accent hover:bg-accent/10"
                title="Demonstração do Resultado do Exercício"
              >
                <FileText className="w-4 h-4" /> Gerar DRE
              </Button> */}
              <span className="text-sm text-muted-foreground">
                Total: <strong className="text-foreground">{totalFiltered}</strong> registros
              </span>
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="w-3 h-3" /> Limpar
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <ComissionamentoFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={onManualSubmit}
        opcoes={opcoes}
        existingRecords={filteredData}
      />
      {isAdmin && (
        <div className="filter-section">
          <MultiSelect
            label="Unidade"
            options={uniqueCidades}
            selected={filters.cidade}
            onChange={(val) => setFilters({ cidade: val })}
          />

          <div className="form-group">
            <Label className="form-label">Data Inicial</Label>
            <input
              type="date"
              className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
              value={filters.dataInicio}
              onChange={e => setFilters({ dataInicio: e.target.value })}
            />
          </div>

          <div className="form-group">
            <Label className="form-label">Data Final</Label>
            <input
              type="date"
              className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
              value={filters.dataFim}
              onChange={e => setFilters({ dataFim: e.target.value })}
            />
          </div>

          <MultiSelect
            label="Favorecido"
            options={uniqueNomes}
            selected={filters.nome}
            onChange={(val) => setFilters({ nome: val })}
          />

          <MultiSelect
            label="Centro de Custo"
            options={uniqueCentroCusto}
            selected={filters.contrato}
            onChange={(val) => setFilters({ contrato: val })}
          />

          <MultiSelect
            label="Conta Analítica"
            options={uniqueContasAnaliticas}
            selected={filters.contaAnalitica}
            onChange={(val) => setFilters({ contaAnalitica: val })}
          />

          <MultiSelect
            label="Banco"
            options={uniqueBancos}
            selected={filters.banco}
            onChange={(val) => setFilters({ banco: val })}
          />

          <MultiSelect
            label="Status"
            options={statusOptions}
            selected={filters.status}
            onChange={(val) => setFilters({ status: val })}
          />
        </div>
      )}
    </div>
  );
};
