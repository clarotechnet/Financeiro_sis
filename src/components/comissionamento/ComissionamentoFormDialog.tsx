import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, CheckCircle, Loader2, Search, X } from 'lucide-react';
import { LancamentoPix, OpcaoSelect } from '@/types/comissionamento';
import { useAuth } from '@/contexts/useAuth';
import { externalSupabase } from '@/integrations/supabase/externalClient';

interface RegistroDados {
  id: string;
  nome: string;
  cpf: string;
  setor: string | null;
}

interface FornecedorResumo {
  id: string;
  cnpj: string;
  nome: string;
  unidade_codigo: string | null;
  unidade_nome: string | null;
  setor_codigo: string | null;
  setor_nome: string | null;
  chave_pix: string | null;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: OpcaoSelect[];
  required?: boolean;
}

const formatCpf = (cpf: string): string => {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const formatCnpj = (cnpj: string): string => {
  const d = (cnpj || '').replace(/\D/g, '').slice(0, 14);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

interface OpcoesData {
  cnpj: OpcaoSelect[];
  unidade: OpcaoSelect[];
  centro_de_custo: OpcaoSelect[];
  categoria: OpcaoSelect[];
  secao_custeio: OpcaoSelect[];
  centro_custeio: OpcaoSelect[];
  plano_contas: OpcaoSelect[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    data_lancamento: string;
    nome: string;
    chave_pix: string | null;
    favorecido: string;
    descricao: string | null;
    plano_conta_id: string;
    valor: number;
    cnpj_id: string | null;
    unidade_id: string;
    centro_de_custo_id: string;
    categoria_id: string | null;
    secao_custeio_id: string | null;
    centro_custeio_id: string | null;
    status_pag: string;
  }) => Promise<void>;
  opcoes: OpcoesData;
  existingRecords?: LancamentoPix[];
}

const emptyForm = {
  data_lancamento: '',
  nome: '',
  chave_pix: '',
  favorecido: '',
  descricao: '',
  plano_conta_id: '',
  valor: '',
  cnpj_id: '',
  unidade_id: '',
  centro_de_custo_id: '',
  secao_custeio_id: '',
  centro_custeio_id: '',
  status_pag: 'A PAGAR',
};

const requiredFields = [
  'data_lancamento', 'nome', 'favorecido', 'valor',
  'unidade_id', 'centro_de_custo_id', 'plano_conta_id'
];

const DRAFT_KEY = 'technet-pix-form-draft';
type FormState = typeof emptyForm;

type ActiveSuggest = 'favorecido' | 'chave_pix' | 'cpf_cadastro' | 'fornecedor_cadastro' | null;

const STATUS_OPTIONS: OpcaoSelect[] = [
  { id: 'A PAGAR', nome: 'A PAGAR' },
  { id: 'PAGO', nome: 'PAGO' },
];

const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : 'Erro ao enviar';

const findIdByName = (opts: OpcaoSelect[], name: string | null | undefined): string => {
  if (!name) return '';
  const target = name.trim().toLowerCase();
  const normalizeLabel = (value: string) =>
    value.replace(/^\s*\d+\s*-\s*/, '').trim().toLowerCase();
  const normalizedTarget = normalizeLabel(name);
  const match = opts.find(o => {
    const option = (o.nome || '').trim().toLowerCase();
    const normalizedOption = normalizeLabel(o.nome || '');
    return option === target
      || normalizedOption === normalizedTarget
      || normalizedOption.endsWith(normalizedTarget);
  });
  return match?.id || '';
};

// Formata string de dígitos brutos como "R$ 0,00"
const fmtCurrencyDisplay = (digits: string): string => {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return '';
  const padded = clean.padStart(3, '0');
  const intPart = padded.slice(0, -2);
  const decPart = padded.slice(-2);
  const formattedInt = parseInt(intPart, 10).toLocaleString('pt-BR');
  return `R$ ${formattedInt},${decPart}`;
};

// Extrai apenas os dígitos de um valor já formatado
const extractDigits = (raw: string): string => raw.replace(/\D/g, '');

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  required = true,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(option => option.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const filteredOptions = options.filter(option =>
    option.nome.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className={`space-y-1 relative ${open ? 'z-50' : 'z-auto'}`} ref={ref}>
      <Label className="text-sm font-medium">{label} {required && '*'}</Label>
      <button
        type="button"
        className={`w-full bg-card border rounded-lg px-3 py-2 text-left text-sm text-foreground flex items-center justify-between gap-2 ${open ? 'border-primary' : 'border-border'}`}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className={selectedOption ? 'truncate' : 'text-muted-foreground truncate'}>
          {selectedOption?.nome || 'Selecione...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
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
                aria-label="Limpar busca"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {selectedOption && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setSearch('');
                }}
              >
                <X className="w-4 h-4" />
                Limpar selecao
              </button>
            )}

            {filteredOptions.map(option => (
              <button
                key={option.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span className={`h-4 w-4 rounded border border-border ${value === option.id ? 'bg-primary border-primary' : ''}`} />
                <span>{option.nome}</span>
              </button>
            ))}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ComissionamentoFormDialog: React.FC<Props> = ({ open, onClose, onSubmit, opcoes, existingRecords = [] }) => {
  const { profile } = useAuth();
  const userName = profile?.display_name || '';

  const [form, setForm] = useState(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      const base = saved ? { ...emptyForm, ...JSON.parse(saved) } : { ...emptyForm };
      return { ...base, nome: userName || base.nome };
    } catch {
      return { ...emptyForm, nome: userName };
    }
  });

  const [valorDisplay, setValorDisplay] = useState(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      return fmtCurrencyDisplay(extractDigits(String(parsed.valor || '')));
    } catch {
      return '';
    }
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [activeSuggest, setActiveSuggest] = useState<ActiveSuggest>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  const [cpfQuery, setCpfQuery] = useState('');
  const [registros, setRegistros] = useState<RegistroDados[]>([]);
  const [fornecedorQuery, setFornecedorQuery] = useState('');
  const [fornecedores, setFornecedores] = useState<FornecedorResumo[]>([]);
  const [fornecedorSearchError, setFornecedorSearchError] = useState('');

  useEffect(() => {
    if (!open) return;
    const term = cpfQuery.trim();
    if (term.length < 2) { setRegistros([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data, error: err } = await externalSupabase
        .rpc('buscar_registros_dados', { termo: term });
      if (!cancelled && !err && Array.isArray(data)) {
        setRegistros(data as RegistroDados[]);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, cpfQuery]);

  useEffect(() => {
    if (!open) return;
    const term = fornecedorQuery.trim();
    const digits = term.replace(/\D/g, '');
    if (term.length < 2) {
      setFornecedores([]);
      setFornecedorSearchError('');
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setFornecedorSearchError('');

      const nomeQuery = externalSupabase
        .from('vw_fornecedores')
        .select('id, cnpj, nome, unidade_codigo, unidade_nome, setor_codigo, setor_nome, chave_pix')
        .eq('ativo', true)
        .ilike('nome', `%${term}%`)
        .order('nome', { ascending: true })
        .limit(8);

      const cnpjQuery = digits.length >= 2
        ? externalSupabase
          .from('vw_fornecedores')
          .select('id, cnpj, nome, unidade_codigo, unidade_nome, setor_codigo, setor_nome, chave_pix')
          .eq('ativo', true)
          .ilike('cnpj', `%${digits}%`)
          .order('nome', { ascending: true })
          .limit(8)
        : Promise.resolve({ data: [], error: null });

      const [nomeResult, cnpjResult] = await Promise.all([nomeQuery, cnpjQuery]);
      if (cancelled) return;

      if (nomeResult.error || cnpjResult.error) {
        console.error('Erro ao buscar fornecedor:', nomeResult.error || cnpjResult.error);
        setFornecedorSearchError('Nao foi possivel buscar fornecedores.');
        setFornecedores([]);
        return;
      }

      const byId = new Map<string, FornecedorResumo>();
      [...(nomeResult.data || []), ...(cnpjResult.data || [])].forEach((row: any) => {
        byId.set(row.id, row as FornecedorResumo);
      });
      setFornecedores(Array.from(byId.values()).slice(0, 8));
    }, 250);

    return () => { cancelled = true; clearTimeout(t); };
  }, [open, fornecedorQuery]);

  const cpfSuggestions = useMemo(() => {
    if (cpfQuery.trim().length < 2) return [];
    return registros.slice(0, 8);
  }, [cpfQuery, registros]);

  const fornecedorSuggestions = useMemo(() => {
    if (fornecedorQuery.trim().length < 2) return [];
    return fornecedores.slice(0, 8);
  }, [fornecedorQuery, fornecedores]);

  const applyRegistro = (r: RegistroDados) => {
    setForm(prev => ({
      ...prev,
      favorecido: r.nome || prev.favorecido,
      chave_pix: r.cpf || prev.chave_pix,
    }));
    setCpfQuery(`${r.nome} — ${formatCpf(r.cpf)}`);
    setActiveSuggest(null);
  };

  const applyFornecedor = (fornecedor: FornecedorResumo) => {
    setForm(prev => ({
      ...prev,
      favorecido: fornecedor.nome || prev.favorecido,
      chave_pix: fornecedor.chave_pix || '',
      unidade_id: fornecedor.unidade_codigo || prev.unidade_id,
      centro_de_custo_id: fornecedor.setor_codigo || prev.centro_de_custo_id,
    }));
    setFornecedorQuery(`${fornecedor.nome} - ${formatCnpj(fornecedor.cnpj)}`);
    setActiveSuggest(null);
  };

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  // Keep nome field synced with logged-in user
  useEffect(() => {
    if (userName && form.nome !== userName) {
      setForm(prev => ({ ...prev, nome: userName }));
    }
  }, [userName]);

  useEffect(() => {
    const hasDraft = Object.values(form).some(value => value?.toString().trim());
    if (hasDraft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    else window.localStorage.removeItem(DRAFT_KEY);
  }, [form]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) setActiveSuggest(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Dedup most recent by chave (favorecido|chave_pix)
  const uniqueRecords = useMemo(() => {
    const sorted = [...existingRecords].sort((a, b) => {
      const da = a.created_at || a.data_lancamento || '';
      const db = b.created_at || b.data_lancamento || '';
      return db.localeCompare(da);
    });
    const seen = new Set<string>();
    const out: LancamentoPix[] = [];
    for (const r of sorted) {
      const key = `${(r.favorecido || '').toLowerCase()}|${(r.chave_pix || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }, [existingRecords]);

  const suggestions = useMemo(() => {
    if (activeSuggest !== 'favorecido' && activeSuggest !== 'chave_pix') return [];
    const term = (form[activeSuggest] || '').trim().toLowerCase();
    if (term.length < 2) return [];
    return uniqueRecords.filter(r => {
      const field = (r[activeSuggest] || '').toString().toLowerCase();
      return field.includes(term);
    }).slice(0, 8);
  }, [activeSuggest, form, uniqueRecords]);

  const applySuggestion = (r: LancamentoPix) => {
    setForm(prev => ({
      ...prev,
      favorecido: r.favorecido || prev.favorecido,
      chave_pix: r.chave_pix || prev.chave_pix,
      cnpj_id: findIdByName(opcoes.cnpj, r.cnpj) || prev.cnpj_id,
      unidade_id: findIdByName(opcoes.unidade, r.unidade) || prev.unidade_id,
      centro_de_custo_id: findIdByName(opcoes.centro_de_custo, r.centro_de_custo) || prev.centro_de_custo_id,
      plano_conta_id: r.plano_conta_id || prev.plano_conta_id,
      secao_custeio_id: findIdByName(opcoes.secao_custeio, r.secao_custeio) || prev.secao_custeio_id,
      centro_custeio_id: findIdByName(opcoes.centro_custeio, r.centro_custeio) || prev.centro_custeio_id,
      // mantem data, valor e observacao em branco/inalterados
    }));
    setActiveSuggest(null);
  };

  const handleValorChange = (raw: string) => {
    const digits = extractDigits(raw);
    set('valor', digits);
    setValorDisplay(fmtCurrencyDisplay(digits));
  };

  const isValid = requiredFields.every(f => form[f as keyof FormState]?.toString().trim());

  const handleSubmit = async () => {
    if (!isValid) { setError('Preencha todos os campos obrigatórios.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        data_lancamento: form.data_lancamento,
        nome: form.nome.trim(),
        chave_pix: form.chave_pix.trim() || null,
        favorecido: form.favorecido.trim(),
        descricao: form.descricao?.trim() || null,
        plano_conta_id: form.plano_conta_id,
        valor: parseFloat(form.valor.replace(/[^\d]/g, '')) / 100,
        cnpj_id: null,
        unidade_id: form.unidade_id,
        centro_de_custo_id: form.centro_de_custo_id,
        categoria_id: null,
        secao_custeio_id: null,
        centro_custeio_id: null,
        status_pag: form.status_pag || 'A PAGAR',
      };
      await onSubmit(payload);
      window.localStorage.removeItem(DRAFT_KEY);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setForm({ ...emptyForm, nome: userName });
        setValorDisplay('');
        onClose();
      }, 1300);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    window.localStorage.removeItem(DRAFT_KEY);
    setForm({ ...emptyForm, nome: userName || form.nome });
    setCpfQuery('');
    setFornecedorQuery('');
    setFornecedores([]);
    setFornecedorSearchError('');
    setActiveSuggest(null);
    setValorDisplay('');
    setError('');
  };

  const renderAutocomplete = (
    field: 'favorecido' | 'chave_pix',
    label: string,
    placeholder: string,
    required = true
  ) => (
    <div className="space-y-1 relative" ref={activeSuggest === field ? suggestRef : undefined}>
      <Label className="text-sm font-medium">{label} {required && '*'}</Label>
      <Input
        placeholder={placeholder}
        value={form[field]}
        onChange={e => { set(field, e.target.value); setActiveSuggest(field); }}
        onFocus={() => setActiveSuggest(field)}
        autoComplete="off"
      />
      {activeSuggest === field && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((r, idx) => (
            <button
              key={(r.id || '') + idx}
              type="button"
              onClick={() => applySuggestion(r)}
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0"
            >
              <div className="font-medium text-foreground">{r.favorecido}</div>
              <div className="text-xs text-muted-foreground truncate">{r.chave_pix} · {r.unidade || '-'}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="w-12 h-12 text-primary" />
            <p className="text-lg font-semibold text-foreground">Lançamento registrado com sucesso!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-1 relative" ref={activeSuggest === 'cpf_cadastro' ? suggestRef : undefined}>
                <Label className="text-sm font-medium">Buscar cadastrado (CPF / Nome)</Label>
                <Input
                  placeholder="Digite CPF ou nome cadastrado"
                  value={cpfQuery}
                  onChange={e => { setCpfQuery(e.target.value); setActiveSuggest('cpf_cadastro'); }}
                  onFocus={() => setActiveSuggest('cpf_cadastro')}
                  autoComplete="off"
                />
                {activeSuggest === 'cpf_cadastro' && cpfSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {cpfSuggestions.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => applyRegistro(r)}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0"
                      >
                        <div className="font-medium text-foreground">{r.nome}</div>
                        <div className="text-xs text-muted-foreground">CPF: {formatCpf(r.cpf)} {r.setor ? `· ${r.setor}` : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Preenche automaticamente Favorecido e Chave PIX (CPF).</p>
              </div>

              <div className="space-y-1 relative" ref={activeSuggest === 'fornecedor_cadastro' ? suggestRef : undefined}>
                <Label className="text-sm font-medium">Buscar Fornecedor</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Digite nome ou CNPJ do fornecedor"
                    value={fornecedorQuery}
                    onChange={e => { setFornecedorQuery(e.target.value); setActiveSuggest('fornecedor_cadastro'); }}
                    onFocus={() => setActiveSuggest('fornecedor_cadastro')}
                    autoComplete="off"
                  />
                </div>
                {activeSuggest === 'fornecedor_cadastro' && fornecedorQuery.trim().length >= 2 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {fornecedorSearchError && (
                      <div className="px-3 py-2 text-sm text-destructive">{fornecedorSearchError}</div>
                    )}
                    {!fornecedorSearchError && fornecedorSuggestions.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum fornecedor encontrado</div>
                    )}
                    {!fornecedorSearchError && fornecedorSuggestions.map((fornecedor) => (
                      <button
                        key={fornecedor.id}
                        type="button"
                        onClick={() => applyFornecedor(fornecedor)}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0"
                      >
                        <div className="font-medium text-foreground">{fornecedor.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          CNPJ: {formatCnpj(fornecedor.cnpj)} - {fornecedor.unidade_nome || '-'} - {fornecedor.setor_nome || '-'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Preenche Favorecido, Chave PIX, Unidade e Centro de Custo.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Data Para Pagamento*</Label>
                <Input type="date" value={form.data_lancamento} onChange={e => set('data_lancamento', e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Nome Do Lançador*</Label>
                <Input
                  placeholder="Nome do lançamento"
                  value={form.nome}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                  title="Preenchido automaticamente com o usuário logado"
                />
              </div>

              {renderAutocomplete('chave_pix', 'Chave PIX', 'CPF/CNPJ/E-mail/Telefone/Aleatória', false)}
              {renderAutocomplete('favorecido', 'Favorecido', 'Nome do favorecido')}

              <div className="space-y-1">
                <Label className="text-sm font-medium">Valor *</Label>
                <Input
                  placeholder="R$ 0,00"
                  inputMode="decimal"
                  value={valorDisplay}
                  onChange={e => handleValorChange(e.target.value)}
                  onFocus={e => {
                    if (!valorDisplay) handleValorChange('');
                  }}
                />
              </div>

              <SearchableSelect
                label="Unidade"
                value={form.unidade_id}
                onChange={value => set('unidade_id', value)}
                options={opcoes.unidade}
              />
              <SearchableSelect
                label="Centro de Custo"
                value={form.centro_de_custo_id}
                onChange={value => set('centro_de_custo_id', value)}
                options={opcoes.centro_de_custo}
              />
              <SearchableSelect
                label="Conta Analítica"
                value={form.plano_conta_id}
                onChange={value => set('plano_conta_id', value)}
                options={opcoes.plano_contas}
              />

              <SearchableSelect
                label="Status Pagamento"
                value={form.status_pag}
                onChange={value => set('status_pag', value)}
                options={STATUS_OPTIONS}
              />

              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm text-muted-foreground">Observação</Label>
                <Input placeholder="Observação (opcional)" value={form.descricao} onChange={e => set('descricao', e.target.value)} />
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
