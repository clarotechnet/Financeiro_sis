import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Wallet, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

import { LoadingSpinner } from '@/components/comissionamento/LoadingSpinner';
import { useFolhaPagamento, VERBA_FIELDS } from '@/hooks/useFolhaPagamento';
import type { DadoFinanceiro } from '@/hooks/useFolhaPagamento';
import { FolhaImportExcel } from '@/components/folha/FolhaImportExcel';
import { FolhaKPIs } from '@/components/folha/FolhaKPIs';
import { FolhaCharts } from '@/components/folha/FolhaCharts';
import { FolhaFrentes } from '@/components/folha/FolhaFrentes';
import { FolhaTable } from '@/components/folha/FolhaTable';
import { useAuth } from '@/contexts/useAuth';
import { useToast } from '@/hooks/use-toast';
import { downloadOperationalReport } from '@/lib/operationalReports';
import { ROLE_RH } from '@/lib/profileRoles';

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

const TABS = [
  { id: 'kpis', label: 'KPIs' },
  { id: 'charts', label: 'Gráficos' },
  { id: 'frentes', label: 'Detalhe por centro de custo' },
];

const FOLHA_EXPORT_COLUMNS: { header: string; field: keyof DadoFinanceiro }[] = [
  { header: 'HORAS NORMAIS', field: 'sal_folha' },
  { header: 'PRO-LABORE', field: 'pro_labore' },
  { header: 'PERICULOSIDADE', field: 'periculosidade' },
  { header: 'HORAS EXTRAS 50%', field: 'hora_extra_50' },
  { header: 'HORAS EXTRAS 60%', field: 'hora_extra_60' },
  { header: 'HORAS EXTRAS 70%', field: 'hora_extra_70' },
  { header: 'HORAS EXTRAS 100%', field: 'hora_extra_100' },
  { header: 'QUINQUENIO', field: 'quinquenio' },
  { header: 'DISTRIBUICAO DE LUCROS', field: 'distribuicao_lucros' },
  { header: 'REFLEXO EXTRAS DSR', field: 'reflexo_extras_dsr' },
  { header: 'ESTOURO DO MES', field: 'estouro_mes' },
  { header: 'DIFERENCA DE 1/3 DE FERIAS', field: 'diferenca_um_terco_ferias' },
  { header: 'DIFERENCA MEDIA HORA FERIAS', field: 'diferenca_media_hora_ferias' },
  { header: 'HORAS AFAST. P/DOENCA C/DIR.INTEGRAIS', field: 'horas_afast_doenca_integral' },
  { header: 'MEDIA AFAST DOENCA DIR. INTEGRAL', field: 'media_afast_doenca_integral' },
  { header: 'PERICULOSIDADE IGUAL OU INFE. 15/30 DIAS', field: 'periculosidade_proporcional' },
  { header: 'INSS DIFERENCA FERIAS', field: 'inss_diferenca_ferias' },
  { header: 'INSS EMPREGADOR', field: 'inss_empregador' },
  { header: 'IRRF EMPREGADOR', field: 'irrf_empregador' },
  { header: 'I.N.S.S.', field: 'inss' },
  { header: 'Total proventos', field: 'total_proventos' },
  { header: 'Total descontos', field: 'total_descontos' },
  { header: 'Líquidos', field: 'salario_liquido' },
];

const FolhaPagamento: React.FC = () => {
  const [params] = useSearchParams();
  const activeTab = params.get('tab') || 'kpis';
  const { isAdmin, profile } = useAuth();
  const canImport = isAdmin || profile?.role === ROLE_RH;
  const { toast } = useToast();
  const {
    data, isLoading, error, filters, setFilters, clearFilters,
    fetchData, importExcel, opcoesCentrosCusto, opcoesNomes, opcoesUnidades,
    kpis, centrosCusto, composicaoDespesas, unidadesDetalhe,
  } = useFolhaPagamento();

  const formatDatePtBr = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };
  const handleExport = () => {
    if (data.length === 0) {
      alert('Sem dados para exportar.');
      return;
    }
    const rows = data.map(r => ({
      Data: formatDatePtBr(r.data),
      Nome: r.nome,
      CPF: r.cpf,
      Setor: r.setor_nome || r.setor || '',
      ...Object.fromEntries(
        FOLHA_EXPORT_COLUMNS.map(column => [column.header, Number(r[column.field]) || 0]),
      ),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 34 },
      { wch: 16 },
      { wch: 38 },
      ...FOLHA_EXPORT_COLUMNS.map(column => ({
        wch: Math.max(16, Math.min(column.header.length + 3, 44)),
      })),
    ];

    const worksheetRange = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    if (worksheetRange) {
      for (let row = worksheetRange.s.r + 1; row <= worksheetRange.e.r; row += 1) {
        for (let column = 4; column <= worksheetRange.e.c; column += 1) {
          const cell = ws[XLSX.utils.encode_cell({ r: row, c: column })];
          if (cell?.t === 'n') cell.z = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Folha');
    XLSX.writeFile(wb, `folha_pagamento_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleGenerateReport = () => {
    try {
      const result = downloadOperationalReport('folha_pagamento', data.map(row => ({
        date: row.data,
        unitCode: row.unidade_codigo,
        unitName: row.unidade_nome,
        costCenterCode: row.setor_codigo,
        costCenterName: row.setor_nome || row.setor,
        value: row.salario_liquido,
      })));

      toast({
        title: 'Relatorio gerado',
        description: `${result.rows.length} linha(s) consolidadas por data, unidade e centro de custo.${result.ignored ? ` ${result.ignored} registro(s) sem classificacao foram ignorados.` : ''}`,
      });
    } catch (reportError: any) {
      toast({
        title: 'Nao foi possivel gerar o relatorio',
        description: reportError.message || 'Confira os dados filtrados.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-glow"
            style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground">Folha de Pagamento</h1>
            <p className="text-sm text-muted-foreground">Gestão e análise da folha</p>
          </div>
        </div>

        <div className="card" style={{ position: 'relative', zIndex: 10 }}>
          <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
            <h3 className="text-lg font-bold text-foreground">Filtros</h3>
            <div className="flex items-center gap-3 flex-wrap">
              {canImport && <FolhaImportExcel onImport={importExcel} />}
              <Button variant="outline" size="sm" onClick={handleGenerateReport} disabled={data.length === 0} className="gap-1">
                <FileSpreadsheet className="w-4 h-4" /> Gerar Relatorio
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
                <Download className="w-4 h-4" /> Exportar Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchData()} className="gap-1">
                <RefreshCw className="w-4 h-4" /> Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1">
                Limpar
              </Button>
            </div>
          </div>

          <div className="filter-section">
            <MultiSelect label="Unidade" options={opcoesUnidades} selected={filters.unidade} onChange={v => setFilters({ unidade: v })} />
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
              label="Centro de Custo"
              options={opcoesCentrosCusto}
              selected={filters.centroCusto}
              onChange={v => setFilters({ centroCusto: v })}
            />
            <MultiSelect label="Verba" options={VERBA_FIELDS.map(v => v.label)} selected={filters.verbas} onChange={v => setFilters({ verbas: v })} />
            <MultiSelect label="Nome" options={opcoesNomes} selected={filters.nome} onChange={v => setFilters({ nome: v })} />
          </div>
        </div>

        {error && (
          <div className="card text-destructive">Erro ao carregar dados: {error}</div>
        )}


        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="tab-content">
            {activeTab === 'kpis' && <FolhaKPIs kpis={kpis} />}
            {activeTab === 'charts' && <FolhaCharts centrosCusto={centrosCusto} composicaoDespesas={composicaoDespesas} />}
            {activeTab === 'frentes' && <FolhaFrentes unidades={unidadesDetalhe} />}
            {activeTab === 'table' && <FolhaTable data={data} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default FolhaPagamento;
