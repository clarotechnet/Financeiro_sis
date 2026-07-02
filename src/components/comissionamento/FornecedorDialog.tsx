import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Loader2, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { OpcaoSelect } from '@/types/comissionamento';

interface OpcoesFornecedor {
  unidade: OpcaoSelect[];
  centro_de_custo: OpcaoSelect[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  opcoes: OpcoesFornecedor;
}

interface FornecedorRow {
  id: string;
  cnpj: string;
  nome: string;
  unidade_codigo: string | null;
  unidade_nome: string | null;
  setor_codigo: string | null;
  setor_nome: string | null;
  telefone: string | null;
  email: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  chave_pix: string | null;
  ativo: boolean;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: OpcaoSelect[];
  required?: boolean;
}

const emptyForm = {
  cnpj: '',
  nome: '',
  telefone: '',
  email: '',
  unidade_codigo: '',
  setor_codigo: '',
  banco: '',
  agencia: '',
  conta: '',
  chave_pix: '',
};

type FormState = typeof emptyForm;

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const formatCnpj = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

const formatCnpjFromDigits = (value: string) => formatCnpj(value);

const formatPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed || null;
};

const SearchableSelect: React.FC<SearchableSelectProps> = ({ label, value, onChange, options, required = true }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(option => option.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
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

  const selectOption = (optionId: string) => {
    onChange(optionId);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={`space-y-1 relative ${open ? 'z-50' : 'z-auto'}`} ref={ref}>
      <Label className="text-sm font-medium">{label} {required && '*'}</Label>
      <button
        type="button"
        className={`w-full bg-card border rounded-lg px-3 py-2 text-left text-sm text-foreground flex items-center justify-between gap-2 ${open ? 'border-primary' : 'border-border'}`}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className={selectedOption ? '' : 'text-muted-foreground'}>
          {selectedOption?.nome || 'Selecione...'}
        </span>
        <span className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <Input
            className="h-9 rounded-none border-0 border-b border-border focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Buscar..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            autoFocus
          />

          <div className="max-h-56 overflow-y-auto py-1">
            {filteredOptions.map(option => (
              <button
                key={option.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                onClick={() => selectOption(option.id)}
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

export const FornecedorDialog: React.FC<Props> = ({ open, onClose, opcoes }) => {
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [matches, setMatches] = useState<FornecedorRow[]>([]);
  const [selectedFornecedor, setSelectedFornecedor] = useState<FornecedorRow | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  useEffect(() => {
    if (!open) return;

    const term = form.nome.trim();
    if (term.length < 2) {
      setMatches([]);
      setSearchError('');
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');

      const { data, error: fetchError } = await externalSupabase
        .from('vw_fornecedores')
        .select('id, cnpj, nome, telefone, email, unidade_codigo, unidade_nome, setor_codigo, setor_nome, banco, agencia, conta, chave_pix, ativo')
        .eq('ativo', true)
        .ilike('nome', `%${term}%`)
        .order('nome', { ascending: true })
        .limit(8);

      if (cancelled) return;

      if (fetchError) {
        console.error('Erro ao buscar fornecedores:', fetchError);
        setSearchError('Nao foi possivel buscar fornecedores. Confira se a migration foi rodada.');
        setMatches([]);
      } else {
        setMatches((data || []) as FornecedorRow[]);
      }

      setSearching(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, form.nome]);

  const applyFornecedor = (fornecedor: FornecedorRow) => {
    setSelectedFornecedor(fornecedor);
    setForm({
      cnpj: formatCnpjFromDigits(fornecedor.cnpj || ''),
      nome: fornecedor.nome || '',
      telefone: formatPhone(fornecedor.telefone || ''),
      email: fornecedor.email || '',
      unidade_codigo: fornecedor.unidade_codigo || '',
      setor_codigo: fornecedor.setor_codigo || '',
      banco: fornecedor.banco || '',
      agencia: fornecedor.agencia || '',
      conta: fornecedor.conta || '',
      chave_pix: fornecedor.chave_pix || '',
    });
    setError('');
    setSuccess('');
  };

  const handleClear = () => {
    setForm({ ...emptyForm });
    setSelectedFornecedor(null);
    setMatches([]);
    setError('');
    setSearchError('');
    setSuccess('');
  };

  const handleSave = async () => {
    const cnpj = onlyDigits(form.cnpj);
    const nome = form.nome.trim();

    if (!cnpj || !nome) {
      setError('Preencha CNPJ e nome.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      cnpj,
      nome,
      telefone: emptyToNull(onlyDigits(form.telefone)),
      email: emptyToNull(form.email),
      unidade_codigo: emptyToNull(form.unidade_codigo),
      setor_codigo: emptyToNull(form.setor_codigo),
      banco: emptyToNull(form.banco),
      agencia: emptyToNull(form.agencia),
      conta: emptyToNull(form.conta),
      chave_pix: emptyToNull(form.chave_pix),
      ativo: true,
    };

    const result = selectedFornecedor
      ? await externalSupabase
        .from('fornecedores')
        .update(payload)
        .eq('id', selectedFornecedor.id)
      : await externalSupabase
        .from('fornecedores')
        .insert([payload]);

    setSaving(false);

    if (result.error) {
      console.error('Erro ao salvar fornecedor:', result.error);
      setError(
        result.error.code === '23505'
          ? 'Ja existe fornecedor ativo com esse CNPJ.'
          : result.error.message || 'Nao foi possivel salvar o fornecedor.'
      );
      return;
    }

    setSuccess(selectedFornecedor ? 'Fornecedor atualizado com sucesso.' : 'Fornecedor cadastrado com sucesso.');
    window.setTimeout(() => {
      handleClear();
      onClose();
    }, 900);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-2xl overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Cadastrar Fornecedor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">CNPJ *</Label>
              <Input
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                value={form.cnpj}
                onChange={event => set('cnpj', formatCnpj(event.target.value))}
              />
            </div>

            <div className="space-y-1 relative">
              <Label className="text-sm font-medium">Nome *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Digite para buscar ou cadastrar"
                  value={form.nome}
                  onChange={event => set('nome', event.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Telefone</Label>
              <Input
                placeholder="(00) 00000-0000"
                inputMode="tel"
                value={form.telefone}
                onChange={event => set('telefone', formatPhone(event.target.value))}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium">Email</Label>
              <Input
                placeholder="email@fornecedor.com"
                type="email"
                value={form.email}
                onChange={event => set('email', event.target.value)}
              />
            </div>

          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Dados bancários</h4>
              <p className="text-xs text-muted-foreground">Informe os dados de pagamento do fornecedor quando disponiveis.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Banco</Label>
                <Input
                  placeholder="Nome do banco"
                  value={form.banco}
                  onChange={event => set('banco', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Agencia</Label>
                <Input
                  placeholder="Agencia"
                  value={form.agencia}
                  onChange={event => set('agencia', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Conta</Label>
                <Input
                  placeholder="Conta"
                  value={form.conta}
                  onChange={event => set('conta', event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Chave Pix</Label>
                <Input
                  placeholder="CPF/CNPJ/E-mail/Telefone/Aleatoria"
                  value={form.chave_pix}
                  onChange={event => set('chave_pix', event.target.value)}
                />
              </div>
            </div>
          </div>

          {form.nome.trim().length >= 2 && (
            <div className="rounded-lg border border-border bg-card/70">
              <div className="px-3 py-2 border-b border-border text-xs font-semibold text-muted-foreground">
                Fornecedores encontrados pelo nome
              </div>

              {searching && (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando fornecedores...
                </div>
              )}

              {!searching && searchError && (
                <div className="px-3 py-3 text-sm text-destructive">{searchError}</div>
              )}

              {!searching && !searchError && matches.length === 0 && (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  Nenhum fornecedor encontrado com esse nome.
                </div>
              )}

              {!searching && !searchError && matches.map(fornecedor => (
                <button
                  key={fornecedor.id}
                  type="button"
                  onClick={() => applyFornecedor(fornecedor)}
                  className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border last:border-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{fornecedor.nome}</span>
                    <span className="text-xs text-muted-foreground">{formatCnpjFromDigits(fornecedor.cnpj)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {fornecedor.unidade_nome || 'Sem unidade'} - {fornecedor.setor_nome || 'Sem centro de custo'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedFornecedor && (
            <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
              Fornecedor existente selecionado. Ao salvar, esse cadastro sera atualizado.
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {success && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Fechar</Button>
          <Button variant="outline" onClick={handleClear} disabled={saving}>Limpar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {selectedFornecedor ? 'Atualizar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
