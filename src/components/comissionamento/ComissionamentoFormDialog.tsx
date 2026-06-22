import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle } from 'lucide-react';
import { LancamentoPix, OpcaoSelect } from '@/types/comissionamento';
import { useAuth } from '@/contexts/useAuth';
import { externalSupabase } from '@/integrations/supabase/externalClient';

interface RegistroDados {
  id: string;
  nome: string;
  cpf: string;
  setor: string | null;
}

const formatCpf = (cpf: string): string => {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

interface OpcoesData {
  cnpj: OpcaoSelect[];
  unidade: OpcaoSelect[];
  centro_de_custo: OpcaoSelect[];
  categoria: OpcaoSelect[];
  secao_custeio: OpcaoSelect[];
  centro_custeio: OpcaoSelect[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    data_lancamento: string;
    nome: string;
    chave_pix: string;
    favorecido: string;
    descricao: string | null;
    valor: number;
    cnpj_id: string;
    unidade_id: string;
    centro_de_custo_id: string;
    categoria_id: string;
    secao_custeio_id: string;
    centro_custeio_id: string;
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
  valor: '',
  cnpj_id: '',
  unidade_id: '',
  centro_de_custo_id: '',
  categoria_id: '',
  secao_custeio_id: '',
  centro_custeio_id: '',
};

const requiredFields = [
  'data_lancamento', 'nome', 'chave_pix', 'favorecido', 'valor',
  'cnpj_id', 'unidade_id', 'centro_de_custo_id', 'categoria_id',
  'secao_custeio_id', 'centro_custeio_id'
];

const DRAFT_KEY = 'technet-pix-form-draft';
type FormState = typeof emptyForm;

const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : 'Erro ao enviar';

const findIdByName = (opts: OpcaoSelect[], name: string | null | undefined): string => {
  if (!name) return '';
  const match = opts.find(o => (o.nome || '').trim().toLowerCase() === name.trim().toLowerCase());
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
  const [activeSuggest, setActiveSuggest] = useState<'favorecido' | 'chave_pix' | 'cpf_cadastro' | null>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  const [cpfQuery, setCpfQuery] = useState('');
  const [registros, setRegistros] = useState<RegistroDados[]>([]);

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

  const cpfSuggestions = useMemo(() => {
    if (cpfQuery.trim().length < 2) return [];
    return registros.slice(0, 8);
  }, [cpfQuery, registros]);

  const applyRegistro = (r: RegistroDados) => {
    setForm(prev => ({
      ...prev,
      favorecido: r.nome || prev.favorecido,
      chave_pix: r.cpf || prev.chave_pix,
      nome: prev.nome || r.nome,
    }));
    setCpfQuery(`${r.nome} — ${formatCpf(r.cpf)}`);
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
    if (!activeSuggest) return [];
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
      nome: r.nome || prev.nome,
      favorecido: r.favorecido || prev.favorecido,
      chave_pix: r.chave_pix || prev.chave_pix,
      cnpj_id: findIdByName(opcoes.cnpj, r.cnpj) || prev.cnpj_id,
      unidade_id: findIdByName(opcoes.unidade, r.unidade) || prev.unidade_id,
      centro_de_custo_id: findIdByName(opcoes.centro_de_custo, r.centro_de_custo) || prev.centro_de_custo_id,
      categoria_id: findIdByName(opcoes.categoria, r.categoria) || prev.categoria_id,
      secao_custeio_id: findIdByName(opcoes.secao_custeio, r.secao_custeio) || prev.secao_custeio_id,
      centro_custeio_id: findIdByName(opcoes.centro_custeio, r.centro_custeio) || prev.centro_custeio_id,
      // mantém data, valor e descrição em branco/inalterados
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
        chave_pix: form.chave_pix.trim(),
        favorecido: form.favorecido.trim(),
        descricao: form.descricao?.trim() || null,
        valor: parseFloat(form.valor.replace(/[^\d]/g, '')) / 100,
        cnpj_id: form.cnpj_id,
        unidade_id: form.unidade_id,
        centro_de_custo_id: form.centro_de_custo_id,
        categoria_id: form.categoria_id,
        secao_custeio_id: form.secao_custeio_id,
        centro_custeio_id: form.centro_custeio_id,
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

  const handleClear = () => { window.localStorage.removeItem(DRAFT_KEY); setForm({ ...emptyForm }); setValorDisplay(''); setError(''); };

  const selectClass = "w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm";

  const renderSelect = (
    field: keyof typeof emptyForm,
    label: string,
    options: OpcaoSelect[],
    required = true
  ) => (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label} {required && '*'}</Label>
      <select
        className={selectClass}
        value={form[field]}
        onChange={e => set(field, e.target.value)}
      >
        <option value="">Selecione...</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
    </div>
  );

  const renderAutocomplete = (field: 'favorecido' | 'chave_pix', label: string, placeholder: string) => (
    <div className="space-y-1 relative" ref={activeSuggest === field ? suggestRef : undefined}>
      <Label className="text-sm font-medium">{label} *</Label>
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
          <DialogTitle>Novo Lançamento PIX</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="w-12 h-12 text-primary" />
            <p className="text-lg font-semibold text-foreground">Lançamento registrado com sucesso!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-1 md:col-span-2 relative" ref={activeSuggest === 'cpf_cadastro' ? suggestRef : undefined}>
                <Label className="text-sm font-medium">Buscar cadastrado (CPF / Nome)</Label>
                <Input
                  placeholder="Digite CPF ou nome cadastrado em registros_dados"
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
              <div className="space-y-1">
                <Label className="text-sm font-medium">Data Para Pagamento*</Label>
                <Input type="date" value={form.data_lancamento} onChange={e => set('data_lancamento', e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Nome *</Label>
                <Input
                  placeholder="Nome do lançamento"
                  value={form.nome}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                  title="Preenchido automaticamente com o usuário logado"
                />
              </div>

              {renderAutocomplete('chave_pix', 'Chave PIX', 'CPF/CNPJ/E-mail/Telefone/Aleatória')}
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

              {renderSelect('cnpj_id', 'CNPJ', opcoes.cnpj)}
              {renderSelect('unidade_id', 'Unidade', opcoes.unidade)}
              {renderSelect('centro_de_custo_id', 'Centro de Custo', opcoes.centro_de_custo)}
              {renderSelect('categoria_id', 'Categoria', opcoes.categoria)}
              {renderSelect('secao_custeio_id', 'Seção de Custeio', opcoes.secao_custeio)}
              {renderSelect('centro_custeio_id', 'Centro de Custeio', opcoes.centro_custeio)}

              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm text-muted-foreground">Descrição</Label>
                <Input placeholder="Descrição (opcional)" value={form.descricao} onChange={e => set('descricao', e.target.value)} />
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
