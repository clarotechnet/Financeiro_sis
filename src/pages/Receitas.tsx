import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileEdit,
  Loader2,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/comissionamento/LoadingSpinner';
import { useAuth } from '@/contexts/useAuth';
import { useReceitas } from '@/hooks/useReceitas';
import { Receita, ReceitaContaOpcao, ReceitaFormPayload, ReceitaSetorOpcao, ReceitaUnidadeOpcao } from '@/types/receitas';

const PAGE_SIZE = 50;

const fmtBRL = (value: number | null | undefined) =>
  (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const fmtCurrencyDisplay = (digits: string): string => {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return '';
  const padded = clean.padStart(3, '0');
  const intPart = padded.slice(0, -2);
  const decPart = padded.slice(-2);
  const formattedInt = parseInt(intPart, 10).toLocaleString('pt-BR');
  return `R$ ${formattedInt},${decPart}`;
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
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (option: string) => {
    if (selected.includes(option)) onChange(selected.filter(item => item !== option));
    else onChange([...selected, option]);
  };

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="form-group" ref={ref} style={{ zIndex: isOpen ? 60 : 1, position: 'relative' }}>
      <Label className="form-label">{label}</Label>
      <div className="multi-select">
        <button
          type="button"
          className={`multi-select-button w-full ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(open => !open)}
        >
          <span className="multi-select-text">
            {selected.length === 0 ? 'Todos' : `${selected.length} selecionado(s)`}
          </span>
          {selected.length > 0 && <span className="selected-count">{selected.length}</span>}
          <ChevronDown className={`w-4 h-4 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="multi-select-dropdown open">
            <input
              type="text"
              className="w-full px-3 py-2 text-sm border-b border-border bg-background text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClick={(event) => event.stopPropagation()}
            />
            {filteredOptions.map(option => (
              <button
                key={option}
                type="button"
                className="multi-select-option w-full text-left"
                onClick={() => toggle(option)}
              >
                <span className={`multi-select-checkbox ${selected.includes(option) ? 'checked' : ''}`} />
                <span>{option}</span>
              </button>
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

const emptyForm = {
  data_recebimento: '',
  nome: '',
  cliente: '',
  valor: '',
  unidade_codigo: '',
  setor_codigo: '',
  plano_conta_id: '',
  banco: '',
  forma_recebimento: '',
  documento: '',
  descricao: '',
};

type ReceitaFormState = typeof emptyForm;

interface ReceitaFormDialogProps {
  open: boolean;
  onClose: () => void;
  opcoesContas: ReceitaContaOpcao[];
  opcoesUnidades: ReceitaUnidadeOpcao[];
  opcoesSetores: ReceitaSetorOpcao[];
  onSubmit: (payload: ReceitaFormPayload) => Promise<void>;
}

const ReceitaFormDialog: React.FC<ReceitaFormDialogProps> = ({
  open,
  onClose,
  opcoesContas,
  opcoesUnidades,
  opcoesSetores,
  onSubmit,
}) => {
  const { profile, user } = useAuth();
  const userName = profile?.display_name || user?.email || '';
  const [form, setForm] = useState<ReceitaFormState>({ ...emptyForm, nome: userName });
  const [valorDisplay, setValorDisplay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !userName) return;
    setForm(prev => prev.nome === userName ? prev : { ...prev, nome: userName });
  }, [open, userName]);

  const set = (field: keyof ReceitaFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleValorChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    set('valor', digits);
    setValorDisplay(fmtCurrencyDisplay(digits));
  };

  const isValid = Boolean(
    form.data_recebimento &&
    form.nome.trim() &&
    form.cliente.trim() &&
    form.valor &&
    form.unidade_codigo &&
    form.setor_codigo &&
    form.plano_conta_id
  );

  const handleClear = () => {
    setForm({ ...emptyForm, nome: userName });
    setValorDisplay('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!isValid) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit({
        data_recebimento: form.data_recebimento,
        nome: form.nome.trim(),
        cliente: form.cliente.trim(),
        descricao: form.descricao.trim() || null,
        valor: parseFloat(form.valor.replace(/\D/g, '')) / 100,
        plano_conta_id: form.plano_conta_id,
        unidade_codigo: form.unidade_codigo,
        setor_codigo: form.setor_codigo,
        banco: form.banco.trim() || null,
        forma_recebimento: form.forma_recebimento.trim() || null,
        documento: form.documento.trim() || null,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        handleClear();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar receita.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectClass = "w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm";

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento de Receita</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="w-12 h-12 text-success" />
            <p className="text-lg font-semibold text-foreground">Receita registrada com sucesso!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Data de Recebimento *</Label>
                <Input
                  type="date"
                  value={form.data_recebimento}
                  onChange={event => set('data_recebimento', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Nome Do Lançador*</Label>
                <Input
                  value={form.nome}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                  title="Preenchido automaticamente com o usuário logado"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Cliente / Origem *</Label>
                <Input
                  placeholder="Ex: Cliente, contrato ou fonte da receita"
                  value={form.cliente}
                  onChange={event => set('cliente', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Valor *</Label>
                <Input
                  placeholder="R$ 0,00"
                  inputMode="decimal"
                  value={valorDisplay}
                  onChange={event => handleValorChange(event.target.value)}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm font-medium">Unidade *</Label>
                <select
                  className={selectClass}
                  value={form.unidade_codigo}
                  onChange={event => set('unidade_codigo', event.target.value)}
                >
                  <option value="">Selecione...</option>
                  {opcoesUnidades.map(opcao => (
                    <option key={opcao.codigo} value={opcao.codigo}>
                      {opcao.codigo} - {opcao.unidade}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm font-medium">Centro de Custo *</Label>
                <select
                  className={selectClass}
                  value={form.setor_codigo}
                  onChange={event => set('setor_codigo', event.target.value)}
                >
                  <option value="">Selecione...</option>
                  {opcoesSetores.map(opcao => (
                    <option key={opcao.codigo} value={opcao.codigo}>
                      {opcao.setor}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm font-medium">Conta Analítica *</Label>
                <select
                  className={selectClass}
                  value={form.plano_conta_id}
                  onChange={event => set('plano_conta_id', event.target.value)}
                >
                  <option value="">Selecione...</option>
                  {opcoesContas.map(opcao => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.nome}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Somente contas analíticas de natureza Receita ou Dedução aparecem aqui.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Banco</Label>
                <Input
                  placeholder="Opcional"
                  value={form.banco}
                  onChange={event => set('banco', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Forma de Recebimento</Label>
                <Input
                  placeholder="PIX, boleto, transferência..."
                  value={form.forma_recebimento}
                  onChange={event => set('forma_recebimento', event.target.value)}
                />
              </div>



              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Documento</Label>
                <Input
                  placeholder="NF, contrato, recibo..."
                  value={form.documento}
                  onChange={event => set('documento', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Observação</Label>
                <Input
                  placeholder="Observação opcional"
                  value={form.descricao}
                  onChange={event => set('descricao', event.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="ghost" onClick={onClose} disabled={submitting}>Fechar</Button>
              <Button variant="outline" onClick={handleClear} disabled={submitting}>Limpar</Button>
              <Button onClick={handleSubmit} disabled={submitting || !isValid}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Receitas: React.FC = () => {
  const hook = useReceitas();
  const [formOpen, setFormOpen] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    hook.fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opcoesContaAnalitica = useMemo(
    () => hook.opcoesContas.map(opcao => opcao.nome),
    [hook.opcoesContas]
  );

  const hasFilters = Boolean(
    hook.filters.dataInicio ||
    hook.filters.dataFim ||
    hook.filters.contaAnalitica.length > 0
  );

  const sortedData = useMemo(() => {
    return [...hook.data].sort((a, b) =>
      (b.data_recebimento || '').localeCompare(a.data_recebimento || '')
    );
  }, [hook.data]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const pageData = sortedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageStart = sortedData.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, sortedData.length);

  useEffect(() => {
    setPage(0);
  }, [hook.filters.dataFim, hook.filters.dataInicio, hook.filters.contaAnalitica]);

  useEffect(() => {
    setPage(currentPage => Math.min(currentPage, totalPages - 1));
  }, [totalPages]);

  const renderNatureza = (row: Receita) => {
    const isDeducao = row.conta_natureza === 'Dedução';
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${isDeducao
        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        }`}>
        {row.conta_natureza || '-'}
      </span>
    );
  };

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shadow-glow"
            style={{ background: 'linear-gradient(135deg, #22c55e 0%, #0f766e 100%)' }}
          >
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground">RECEITAS</h1>
            <p className="text-sm text-muted-foreground">Faturamento e recebimentos da empresa</p>
          </div>
        </div>

        {hook.error && (
          <div className="alert alert-error">
            <span>Erro ao carregar receitas: {hook.error}</span>
          </div>
        )}

        <div className="card" style={{ position: 'relative', zIndex: 40 }}>
          <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
            <h3 className="text-lg font-bold text-foreground">Filtros</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setFormOpen(true)} className="gap-1">
                <FileEdit className="w-4 h-4" /> Novo Lançamento
              </Button>
              <Button variant="outline" size="sm" onClick={hook.fetchData} className="gap-1">
                <RefreshCw className="w-4 h-4" /> Atualizar
              </Button>
              <span className="text-sm text-muted-foreground">
                Total: <strong className="text-foreground">{hook.data.length}</strong> registros
              </span>
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={hook.clearFilters} className="gap-1">
                  <X className="w-3 h-3" /> Limpar
                </Button>
              )}
            </div>
          </div>

          <ReceitaFormDialog
            open={formOpen}
            onClose={() => setFormOpen(false)}
            opcoesContas={hook.opcoesContas}
            opcoesUnidades={hook.opcoesUnidades}
            opcoesSetores={hook.opcoesSetores}
            onSubmit={hook.submitReceita}
          />

          <div className="filter-section">
            <div className="form-group">
              <Label className="form-label">Data Inicial</Label>
              <input
                type="date"
                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                value={hook.filters.dataInicio}
                onChange={event => hook.setFilters({ dataInicio: event.target.value })}
              />
            </div>

            <div className="form-group">
              <Label className="form-label">Data Final</Label>
              <input
                type="date"
                className="form-control bg-card border border-border rounded-lg px-3 py-2 text-foreground w-full"
                value={hook.filters.dataFim}
                onChange={event => hook.setFilters({ dataFim: event.target.value })}
              />
            </div>

            <MultiSelect
              label="Conta Analítica"
              options={opcoesContaAnalitica}
              selected={hook.filters.contaAnalitica}
              onChange={(selected) => hook.setFilters({ contaAnalitica: selected })}
            />
          </div>
        </div>

        {hook.isLoading && hook.allData.length === 0 ? (
          <LoadingSpinner message="Carregando receitas..." />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Receita Bruta</div>
                <div className="text-xl font-extrabold text-emerald-500 mt-1">{fmtBRL(hook.kpis.totalReceitas)}</div>
              </div>
              <div className="card">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Deduções</div>
                <div className="text-xl font-extrabold text-red-500 mt-1">{fmtBRL(hook.kpis.totalDeducoes)}</div>
              </div>
              <div className="card">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Receita Líquida</div>
                <div className="text-xl font-extrabold text-primary mt-1">{fmtBRL(hook.kpis.receitaLiquida)}</div>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Lançamentos de Receita</h3>
                  <p className="text-sm text-muted-foreground">
                    Entradas classificadas pelo plano de contas para compor a DRE.
                  </p>
                </div>
              </div>

              <div className="max-h-[620px] w-full overflow-auto [scrollbar-gutter:stable]">
                <table className="data-table min-w-[1180px] w-full text-xs">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Cliente / Origem</th>
                      <th>Unidade</th>
                      <th>Centro de Custo</th>
                      <th>Conta Analítica</th>
                      <th>Natureza</th>
                      <th>Banco</th>
                      <th>Forma</th>
                      <th>Documento</th>
                      <th>Observação</th>
                      <th className="text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map(row => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap font-medium">{fmtDate(row.data_recebimento)}</td>
                        <td className="font-medium">{row.cliente || '-'}</td>
                        <td>{row.unidade_nome ? `${row.unidade_codigo} - ${row.unidade_nome}` : '-'}</td>
                        <td>{row.setor_nome || '-'}</td>
                        <td>
                          <div className="font-semibold">{row.conta_analitica || '-'}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.grupo_conta || '-'} / {row.subgrupo_conta || '-'}
                          </div>
                        </td>
                        <td>{renderNatureza(row)}</td>
                        <td>{row.banco || '-'}</td>
                        <td>{row.forma_recebimento || '-'}</td>
                        <td>{row.documento || '-'}</td>
                        <td>{row.descricao || '-'}</td>
                        <td className="text-right font-semibold whitespace-nowrap">{fmtBRL(row.valor)}</td>
                      </tr>
                    ))}
                    {pageData.length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center py-8 text-muted-foreground">
                          Nenhuma receita encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {sortedData.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Mostrando {pageStart}-{pageEnd} de {sortedData.length} linha(s)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Página {page + 1} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage(current => Math.max(0, current - 1))}
                        title="Página anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
                        title="Próxima página"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Receitas;
