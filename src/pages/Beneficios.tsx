import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Download, Fuel, Gift, Loader2, PackagePlus, RefreshCw, Upload, X, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/comissionamento/LoadingSpinner';
import { useBeneficios } from '@/hooks/useBeneficios';
import { useToast } from '@/hooks/use-toast';
import { BeneficioImportPayload, BeneficioImportRow, BeneficioTipo } from '@/types/beneficios';
import { OpcaoSelect } from '@/types/comissionamento';
import { downloadOperationalReport, OperationalReportSource } from '@/lib/operationalReports';

const PAGE_SIZE = 50;

const TABS: { id: BeneficioTipo; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'combustivel', label: 'Combustível', icon: Fuel },
  { id: 'agregamento', label: 'Agregamento', icon: PackagePlus },
  { id: 'flash', label: 'Flash', icon: Zap },
];

const fmtBRL = (value: number | null | undefined) =>
  (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const fmtDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
};

const todayInput = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normKey = (key: string) =>
  key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[Â°Âº]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCpf = (value: any) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length < 11 ? digits.padStart(11, '0') : digits;
};

const parseNum = (value: any): number => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return value;
  const normalized = String(value).replace(/[R$\s.]/g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseBenefitRows = async (file: File, tipo: BeneficioTipo): Promise<BeneficioImportRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

  return raw.flatMap(row => {
    const entries = Object.entries(row);
    let cpfValue: any = null;
    let placaValue: any = null;
    let valorValue: any = null;

    for (const [key, value] of entries) {
      const normalizedKey = normKey(key);
      if (cpfValue == null && normalizedKey.includes('CPF')) cpfValue = value;
      if (tipo === 'combustivel' && placaValue == null && normalizedKey.includes('PLACA')) placaValue = value;
      if (
        valorValue == null &&
        (
          normalizedKey === 'VALOR' ||
          normalizedKey.includes('VALOR') ||
          normalizedKey.includes('COMBUSTIVEL') ||
          normalizedKey.includes('AGREGAMENTO') ||
          normalizedKey.includes('FLASH')
        )
      ) {
        valorValue = value;
      }
    }

    if (cpfValue == null) cpfValue = entries[0]?.[1] ?? null;
    if (tipo === 'combustivel' && placaValue == null) placaValue = entries[1]?.[1] ?? null;
    if (valorValue == null) valorValue = entries[tipo === 'combustivel' ? 2 : 1]?.[1] ?? null;

    const cpf = normalizeCpf(cpfValue);
    const placa = String(placaValue ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    const valor = parseNum(valorValue);
    if (!cpf && !placa && valor <= 0) return [];

    return tipo === 'combustivel' ? [{ cpf, placa, valor }] : [{ cpf, valor }];
  });
};

interface MultiSelectProps {
  label: string;
  options: OpcaoSelect[];
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

  const selectedLabels = useMemo(
    () => selected
      .map(id => options.find(option => option.id === id)?.nome)
      .filter(Boolean) as string[],
    [options, selected]
  );

  const filteredOptions = options.filter(option =>
    option.nome.toLowerCase().includes(search.trim().toLowerCase())
  );

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(item => item !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="form-group" ref={ref} style={{ position: 'relative', zIndex: isOpen ? 60 : 1 }}>
      <Label className="form-label">{label}</Label>
      <button
        type="button"
        className={`multi-select-button w-full ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(open => !open)}
      >
        <span className="multi-select-text">
          {selected.length === 0 ? 'Todos' : selected.length === 1 ? selectedLabels[0] : `${selected.length} selecionado(s)`}
        </span>
        {selected.length > 0 && <span className="selected-count">{selected.length}</span>}
        <ChevronDown className={`w-4 h-4 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="multi-select-dropdown open">
          <div className="relative border-b border-border">
            <Input
              className="h-9 rounded-none border-0 pr-9 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Buscar..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {filteredOptions.map(option => (
            <button
              key={option.id}
              type="button"
              className="multi-select-option w-full text-left"
              onClick={() => toggle(option.id)}
            >
              <span className={`multi-select-checkbox ${selected.includes(option.id) ? 'checked' : ''}`} />
              <span>{option.nome}</span>
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</div>
          )}
        </div>
      )}
    </div>
  );
};

interface ImportDialogProps {
  open: boolean;
  tipo: BeneficioTipo;
  importing: boolean;
  onClose: () => void;
  onImport: (payload: BeneficioImportPayload) => Promise<void>;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ open, tipo, importing, onClose, onImport }) => {
  const [dataBeneficio, setDataBeneficio] = useState(todayInput());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDataBeneficio(todayInput());
    setFile(null);
    setError('');
  }, [open, tipo]);

  const handleSubmit = async () => {
    setError('');
    if (!dataBeneficio) {
      setError('Informe a data do benefício.');
      return;
    }
    if (!file) {
      setError(tipo === 'combustivel'
        ? 'Selecione um arquivo Excel com CPF, Placa e Valor.'
        : 'Selecione um arquivo Excel com CPF e Valor.'
      );
      return;
    }

    try {
      const rows = await parseBenefitRows(file, tipo);
      if (rows.length === 0) {
        setError(tipo === 'combustivel'
          ? 'Nenhuma linha com CPF, Placa e Valor foi encontrada.'
          : 'Nenhuma linha com CPF e Valor foi encontrada.'
        );
        return;
      }

      await onImport({
        data_beneficio: dataBeneficio,
        arquivo_nome: file.name,
        rows,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao ler o arquivo.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Importar {tipo === 'combustivel' ? 'Combustível' : tipo === 'flash' ? 'Flash' : 'Agregamento'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <Label>Data do benefício *</Label>
            <Input
              type="date"
              value={dataBeneficio}
              onChange={event => setDataBeneficio(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Arquivo Excel *</Label>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={event => setFile(event.target.files?.[0] || null)}
            />
            {tipo === 'combustivel' ? (
              <p className="text-xs text-muted-foreground">
                Use uma planilha com as colunas CPF, Placa e Valor. Nome, unidade e centro de custo serao buscados pelo CPF.
              </p>
            ) : (
            <p className="text-xs text-muted-foreground">
              Use uma planilha com as colunas CPF e Valor. Nome, unidade e centro de custo serao buscados pelo CPF.
            </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={importing}>Fechar</Button>
          <Button onClick={handleSubmit} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Beneficios: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tipo: BeneficioTipo = rawTab === 'agregamento' || rawTab === 'flash' ? rawTab : 'combustivel';
  const {
    data,
    isLoading,
    isImporting,
    error,
    filters,
    setFilters,
    clearFilters,
    fetchData,
    importExcel,
    opcoes,
    kpis,
  } = useBeneficios(tipo);
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => { setPage(1); }, [tipo, data.length]);

  const activeTab = TABS.find(tab => tab.id === tipo) || TABS[0];
  const ActiveIcon = activeTab.icon;
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const paginated = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleImport = async (payload: BeneficioImportPayload) => {
    const result = await importExcel(payload);
    const hasErrors = result.errors.length > 0;
    toast({
      title: hasErrors ? 'Importação concluída com avisos' : 'Importação concluída',
      description: `${result.inserted} importado(s), ${result.skipped} ignorado(s).${hasErrors ? ` ${result.errors[0]}` : ''}`,
      variant: hasErrors ? 'destructive' : 'default',
    });
  };

  const handleGenerateReport = () => {
    try {
      const result = downloadOperationalReport(
        `beneficios_${tipo}` as OperationalReportSource,
        data.map(row => ({
          date: row.data_beneficio,
          unitCode: row.unidade_codigo,
          unitName: row.unidade_nome,
          costCenterCode: row.setor_codigo,
          costCenterName: row.setor_nome,
          value: row.valor,
        })),
      );

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
      <div className="max-w-[1500px] mx-auto p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-glow"
              style={{ background: 'linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)' }}
            >
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-foreground">Benefícios</h1>
              <p className="text-sm text-muted-foreground">Importacao por CPF e relatorio por centro de custo</p>
            </div>
          </div>

          <div className="flex rounded-lg border border-border bg-card p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${tipo === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setParams({ tab: tab.id })}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ position: 'relative', zIndex: 10 }}>
          <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ActiveIcon className="w-5 h-5 text-primary" />
                {activeTab.label}
              </h3>
              <p className="text-xs text-muted-foreground">
                O CPF busca nome, unidade e centro de custo em registros_dados. A conta analitica sera escolhida ao importar o relatorio em Inclusao de Pagamentos.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => setImportOpen(true)} size="sm" className="gap-1">
                <Upload className="w-4 h-4" />
                Importar Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleGenerateReport} disabled={data.length === 0} className="gap-1">
                <Download className="w-4 h-4" />
                Gerar Relatorio
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchData()} className="gap-1">
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="space-y-1">
              <Label className="form-label">Data Inicial</Label>
              <Input
                type="date"
                value={filters.dataInicio}
                onChange={event => setFilters({ dataInicio: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="form-label">Data Final</Label>
              <Input
                type="date"
                value={filters.dataFim}
                onChange={event => setFilters({ dataFim: event.target.value })}
              />
            </div>
            <MultiSelect label="Unidade" options={opcoes.unidades} selected={filters.unidade} onChange={value => setFilters({ unidade: value })} />
            <MultiSelect label="Centro de Custo" options={opcoes.setores} selected={filters.setor} onChange={value => setFilters({ setor: value })} />
            <div className="space-y-1">
              <Label className="form-label">Buscar</Label>
              <Input
                placeholder={tipo === 'combustivel' ? 'Nome, CPF ou placa' : 'Nome ou CPF'}
                value={filters.busca}
                onChange={event => setFilters({ busca: event.target.value })}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="card border-destructive/40 text-destructive">Erro ao carregar benefícios: {error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-xs uppercase text-muted-foreground font-semibold">Total de registros</p>
            <strong className="text-2xl text-foreground">{kpis.totalRegistros}</strong>
          </div>
          <div className="card">
            <p className="text-xs uppercase text-muted-foreground font-semibold">Total em benefícios</p>
            <strong className="text-2xl text-primary">{fmtBRL(kpis.totalValor)}</strong>
          </div>
          <div className="card">
            <p className="text-xs uppercase text-muted-foreground font-semibold">Colaboradores</p>
            <strong className="text-2xl text-foreground">{kpis.colaboradores}</strong>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-foreground">Dados Importados</h3>
              <p className="text-xs text-muted-foreground">Linhas paginadas de 50 em 50 para conferência.</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{data.length === 0 ? '0-0' : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, data.length)}`} de {data.length}</span>
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span>{page} / {totalPages}</span>
              <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhum benefício encontrado para os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-3 font-semibold">Data</th>
                    <th className="text-left py-3 px-3 font-semibold">Unidade</th>
                    <th className="text-left py-3 px-3 font-semibold">Nome</th>
                    <th className="text-left py-3 px-3 font-semibold">CPF</th>
                    {tipo === 'combustivel' && (
                      <th className="text-left py-3 px-3 font-semibold">Placa</th>
                    )}
                    <th className="text-left py-3 px-3 font-semibold">Centro de Custo</th>
                    <th className="text-right py-3 px-3 font-semibold">Valor</th>
                    <th className="text-left py-3 px-3 font-semibold">Importado em</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(row => (
                    <tr key={`${row.tipo}-${row.id}`} className="border-b border-border/70 hover:bg-muted/20">
                      <td className="py-3 px-3 font-medium">{fmtDate(row.data_beneficio)}</td>
                      <td className="py-3 px-3">{row.unidade_nome || '-'}</td>
                      <td className="py-3 px-3 font-semibold">{row.nome}</td>
                      <td className="py-3 px-3">{row.cpf}</td>
                      {tipo === 'combustivel' && (
                        <td className="py-3 px-3 font-semibold">{row.placa || '-'}</td>
                      )}
                      <td className="py-3 px-3">{row.setor_nome || '-'}</td>
                      <td className="py-3 px-3 text-right font-bold text-primary">{fmtBRL(row.valor)}</td>
                      <td className="py-3 px-3 text-muted-foreground">{fmtDateTime(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ImportDialog
          open={importOpen}
          tipo={tipo}
          importing={isImporting}
          onClose={() => setImportOpen(false)}
          onImport={handleImport}
        />

        {isImporting && (
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-lg text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Importando benefícios...
          </div>
        )}
        {!isImporting && data.length > 0 && (
          <div className="sr-only" aria-live="polite">
            <CheckCircle className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
};


export default Beneficios;
