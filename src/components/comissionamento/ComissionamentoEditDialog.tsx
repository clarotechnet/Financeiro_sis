import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { LancamentoPix, OpcaoSelect } from '@/types/comissionamento';
import { SearchableSelect } from './SearchableSelect';

interface OpcoesData {
  unidade: OpcaoSelect[];
  centro_de_custo: OpcaoSelect[];
  categoria: OpcaoSelect[];
  plano_contas: OpcaoSelect[];
  bancos: OpcaoSelect[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (id: string, data: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  record: LancamentoPix | null;
  rateioRecords?: LancamentoPix[];
  opcoes: OpcoesData;
}

type RateioState = {
  id: string;
  unidade_id: string;
  centro_de_custo_id: string;
  plano_conta_id: string;
  valor: string;
};

const STATUS_OPTIONS: OpcaoSelect[] = [
  { id: 'A PAGAR', nome: 'A PAGAR' },
  { id: 'PAGO', nome: 'PAGO' },
];

const formatDateForInput = (value: string | null) => {
  if (!value) return '';
  return value.match(/^\d{4}-\d{2}-\d{2}/) ? value.substring(0, 10) : '';
};

const findIdByName = (options: OpcaoSelect[], name: string | null): string => {
  if (!name) return '';
  const normalizeLabel = (value: string) => value.replace(/^\s*\d+\s*-\s*/, '').trim().toLowerCase();
  const target = name.trim().toLowerCase();
  const normalizedTarget = normalizeLabel(name);
  return options.find(option => {
    const optionName = (option.nome || '').trim().toLowerCase();
    const normalizedOption = normalizeLabel(option.nome || '');
    return optionName === target
      || normalizedOption === normalizedTarget
      || normalizedOption.endsWith(normalizedTarget);
  })?.id || '';
};

const extractDigits = (value: string) => value.replace(/\D/g, '');

const centsFromDigits = (value: string) => {
  const digits = extractDigits(value);
  return digits ? Number.parseInt(digits, 10) : 0;
};

const digitsFromNumber = (value: number | null | undefined) =>
  String(Math.max(0, Math.round((Number(value) || 0) * 100)));

const formatCurrency = (digits: string) => {
  const cents = centsFromDigits(digits);
  return `R$ ${(cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const createRateio = (base?: Partial<RateioState>): RateioState => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`,
  unidade_id: base?.unidade_id || '',
  centro_de_custo_id: base?.centro_de_custo_id || '',
  plano_conta_id: base?.plano_conta_id || '',
  valor: base?.valor || '',
});

export const ComissionamentoEditDialog: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  onDelete,
  record,
  rateioRecords = [],
  opcoes,
}) => {
  const [form, setForm] = useState<Record<string, string>>({});
  const [valorDigits, setValorDigits] = useState('');
  const [usarRateio, setUsarRateio] = useState(false);
  const [rateios, setRateios] = useState<RateioState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const existingRateio = Boolean(record?.rateio_lote_id);

  useEffect(() => {
    if (!record) return;

    const loteItems = record.rateio_lote_id
      ? (rateioRecords.length > 0 ? rateioRecords : [record])
      : [];
    const editingRateio = loteItems.length > 0;
    const totalValue = editingRateio
      ? loteItems.reduce((sum, item) => sum + (Number(item.valor) || 0), 0)
      : Number(record.valor) || 0;

    setForm({
      data_lancamento: formatDateForInput(record.data_lancamento),
      nome: record.nome || '',
      chave_pix: record.chave_pix || '',
      favorecido: record.favorecido || '',
      descricao: record.descricao || '',
      banco: record.banco || '',
      banco_codigo: record.banco_codigo || findIdByName(opcoes.bancos, record.banco),
      status_pag: record.status_pag || 'A PAGAR',
      unidade_id: editingRateio ? '' : record.unidade_codigo || findIdByName(opcoes.unidade, record.unidade),
      centro_de_custo_id: editingRateio ? '' : record.setor_codigo || findIdByName(opcoes.centro_de_custo, record.centro_de_custo),
      plano_conta_id: editingRateio ? '' : record.plano_conta_id || '',
    });
    setValorDigits(digitsFromNumber(totalValue));
    setUsarRateio(editingRateio);
    setRateios(editingRateio
      ? loteItems.map(item => createRateio({
        unidade_id: item.unidade_codigo || findIdByName(opcoes.unidade, item.unidade),
        centro_de_custo_id: item.setor_codigo || findIdByName(opcoes.centro_de_custo, item.centro_de_custo),
        plano_conta_id: item.plano_conta_id || '',
        valor: digitsFromNumber(item.valor),
      }))
      : []);
    setError('');
    setSuccess(false);
    setConfirmDelete(false);
  }, [record, rateioRecords, opcoes]);

  const set = (field: string, value: string) => setForm(previous => ({ ...previous, [field]: value }));

  const handleToggleRateio = (checked: boolean) => {
    if (existingRateio && !checked) return;
    setUsarRateio(checked);
    setError('');

    if (checked) {
      setRateios([createRateio({
        unidade_id: form.unidade_id,
        centro_de_custo_id: form.centro_de_custo_id,
        plano_conta_id: form.plano_conta_id,
        valor: valorDigits,
      })]);
      setForm(previous => ({
        ...previous,
        unidade_id: '',
        centro_de_custo_id: '',
        plano_conta_id: '',
      }));
      return;
    }

    const firstRateio = rateios[0];
    setForm(previous => ({
      ...previous,
      unidade_id: firstRateio?.unidade_id || '',
      centro_de_custo_id: firstRateio?.centro_de_custo_id || '',
      plano_conta_id: firstRateio?.plano_conta_id || '',
    }));
    setRateios([]);
  };

  const updateRateio = (id: string, field: keyof Omit<RateioState, 'id'>, value: string) => {
    setRateios(current => current.map(rateio => (
      rateio.id === id ? { ...rateio, [field]: value } : rateio
    )));
  };

  const addRateio = () => setRateios(current => [...current, createRateio()]);

  const removeRateio = (id: string) => {
    setRateios(current => current.length > 1 ? current.filter(rateio => rateio.id !== id) : current);
  };

  const valorTotalCents = centsFromDigits(valorDigits);
  const somaRateioCents = rateios.reduce((sum, rateio) => sum + centsFromDigits(rateio.valor), 0);
  const diferencaRateioCents = valorTotalCents - somaRateioCents;
  const rateiosValidos = rateios.length > 0 && rateios.every(rateio =>
    rateio.unidade_id
    && rateio.centro_de_custo_id
    && rateio.plano_conta_id
    && centsFromDigits(rateio.valor) > 0
  );

  const handleSave = async () => {
    if (!record?.id) return;
    if (!form.data_lancamento || !form.nome?.trim() || !form.favorecido?.trim() || valorTotalCents <= 0) {
      setError('Preencha Data, Nome do Lançador, Favorecido e Valor.');
      return;
    }
    if (!usarRateio && (!form.unidade_id || !form.centro_de_custo_id || !form.plano_conta_id)) {
      setError('Preencha Unidade, Centro de Custo e Conta Analítica.');
      return;
    }
    if (usarRateio && (!rateiosValidos || diferencaRateioCents !== 0)) {
      setError('Verifique os rateios: preencha todas as linhas e deixe a diferença em R$ 0,00.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const bancoSelecionado = opcoes.bancos.find(option => option.id === form.banco_codigo);
      const updates: Record<string, any> = {
        data_lancamento: form.data_lancamento,
        nome: form.nome.trim(),
        chave_pix: form.chave_pix?.trim() || null,
        favorecido: form.favorecido.trim(),
        descricao: form.descricao?.trim() || null,
        valor: valorTotalCents / 100,
        banco_codigo: bancoSelecionado?.id || null,
        banco: bancoSelecionado?.nome || null,
        status_pag: form.status_pag || 'A PAGAR',
        unidade_id: null,
        unidade_codigo: usarRateio ? null : form.unidade_id,
        centro_de_custo_id: null,
        setor_codigo: usarRateio ? null : form.centro_de_custo_id,
        plano_conta_id: usarRateio ? null : form.plano_conta_id,
      };

      if (usarRateio) {
        updates.valor_total = valorTotalCents / 100;
        updates.rateios = rateios.map(rateio => ({
          unidade_id: rateio.unidade_id,
          centro_de_custo_id: rateio.centro_de_custo_id,
          plano_conta_id: rateio.plano_conta_id,
          valor: centsFromDigits(rateio.valor) / 100,
        }));
      }

      await onSave(record.id, updates);
      setSuccessMsg(usarRateio ? 'Rateios atualizados com sucesso!' : 'Registro atualizado com sucesso!');
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (saveError: any) {
      setError(saveError.message || 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!record?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await onDelete(record.id);
      setSuccessMsg(existingRateio ? 'Lote de rateios excluído com sucesso!' : 'Registro excluído com sucesso!');
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (deleteError: any) {
      setError(deleteError.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={nextOpen => {
      if (!nextOpen) {
        setConfirmDelete(false);
        onClose();
      }
    }}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamentos</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold text-foreground">{successMsg}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Data Para Pagamento *</Label>
                <Input type="date" value={form.data_lancamento || ''} onChange={event => set('data_lancamento', event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Nome Do Lançador *</Label>
                <Input value={form.nome || ''} onChange={event => set('nome', event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Chave PIX</Label>
                <Input value={form.chave_pix || ''} onChange={event => set('chave_pix', event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Favorecido *</Label>
                <Input value={form.favorecido || ''} onChange={event => set('favorecido', event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Valor Geral *</Label>
                <Input
                  inputMode="decimal"
                  value={formatCurrency(valorDigits)}
                  onChange={event => setValorDigits(extractDigits(event.target.value))}
                />
              </div>
              <SearchableSelect
                label="Unidade"
                value={form.unidade_id || ''}
                onChange={value => set('unidade_id', value)}
                options={opcoes.unidade}
                required={!usarRateio}
                disabled={usarRateio}
              />
              <SearchableSelect
                label="Centro de Custo"
                value={form.centro_de_custo_id || ''}
                onChange={value => set('centro_de_custo_id', value)}
                options={opcoes.centro_de_custo}
                required={!usarRateio}
                disabled={usarRateio}
              />
              <SearchableSelect
                label="Conta Analítica"
                value={form.plano_conta_id || ''}
                onChange={value => set('plano_conta_id', value)}
                options={opcoes.plano_contas}
                required={!usarRateio}
                disabled={usarRateio}
              />
              <SearchableSelect
                label="Banco"
                value={form.banco_codigo || ''}
                onChange={value => set('banco_codigo', value)}
                options={opcoes.bancos}
                required={false}
              />
              <SearchableSelect
                label="Status Pagamento"
                value={form.status_pag || ''}
                onChange={value => set('status_pag', value)}
                options={STATUS_OPTIONS}
              />

              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 md:col-span-2">
                <label className={`flex items-start gap-3 text-sm font-semibold text-foreground ${existingRateio ? 'cursor-default' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    checked={usarRateio}
                    disabled={existingRateio}
                    onChange={event => handleToggleRateio(event.target.checked)}
                  />
                  <span>
                    Múltiplos Rateios
                    <span className="block text-xs font-normal text-muted-foreground">
                      {existingRateio
                        ? 'Este lançamento já é um lote. Todos os itens serão atualizados juntos.'
                        : 'Ao ativar, Unidade, Centro de Custo, Conta Analítica e Valor serão definidos nas linhas abaixo.'}
                    </span>
                  </span>
                </label>

                {usarRateio && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-border bg-card px-3 py-2">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Valor geral</div>
                        <div className="text-lg font-black text-foreground">{formatCurrency(valorDigits)}</div>
                      </div>
                      <div className="rounded-lg border border-border bg-card px-3 py-2">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Soma do rateio</div>
                        <div className="text-lg font-black text-foreground">{formatCurrency(String(somaRateioCents))}</div>
                      </div>
                      <div className={`rounded-lg border px-3 py-2 ${diferencaRateioCents === 0 ? 'border-green-500/40 bg-green-500/10' : 'border-destructive/40 bg-destructive/10'}`}>
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Diferença</div>
                        <div className={diferencaRateioCents === 0 ? 'text-lg font-black text-green-500' : 'text-lg font-black text-destructive'}>
                          {formatCurrency(String(Math.abs(diferencaRateioCents)))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {rateios.map((rateio, index) => (
                        <div
                          key={rateio.id}
                          className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-2 xl:grid-cols-[minmax(140px,0.9fr)_minmax(210px,1.25fr)_minmax(210px,1.2fr)_minmax(130px,0.75fr)_40px]"
                        >
                          <SearchableSelect
                            label={`Unidade ${index + 1}`}
                            value={rateio.unidade_id}
                            onChange={value => updateRateio(rateio.id, 'unidade_id', value)}
                            options={opcoes.unidade}
                          />
                          <SearchableSelect
                            label="Centro de Custo"
                            value={rateio.centro_de_custo_id}
                            onChange={value => updateRateio(rateio.id, 'centro_de_custo_id', value)}
                            options={opcoes.centro_de_custo}
                          />
                          <SearchableSelect
                            label="Conta Analítica"
                            value={rateio.plano_conta_id}
                            onChange={value => updateRateio(rateio.id, 'plano_conta_id', value)}
                            options={opcoes.plano_contas}
                          />
                          <div className="space-y-1">
                            <Label className="text-sm font-medium">Valor *</Label>
                            <Input
                              className="min-w-0"
                              inputMode="decimal"
                              value={formatCurrency(rateio.valor)}
                              onChange={event => updateRateio(rateio.id, 'valor', extractDigits(event.target.value))}
                            />
                          </div>
                          <div className="flex items-end justify-end md:col-span-2 xl:col-span-1 xl:justify-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 shrink-0 p-0 text-destructive hover:text-destructive"
                              onClick={() => removeRateio(rateio.id)}
                              disabled={rateios.length <= 1}
                              title="Remover rateio"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Button type="button" variant="outline" size="sm" onClick={addRateio}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar rateio
                      </Button>
                      {diferencaRateioCents !== 0 && (
                        <p className="text-sm font-medium text-destructive">
                          A soma precisa ser igual ao Valor Geral para salvar.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm text-muted-foreground">Observação</Label>
                <Input value={form.descricao || ''} onChange={event => set('descricao', event.target.value)} />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="flex w-full gap-2 sm:justify-between sm:gap-2">
              <Button variant="destructive" onClick={handleDelete} disabled={submitting || deleting} className="mr-auto">
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Trash2 className="mr-1 h-4 w-4" />
                {confirmDelete
                  ? (existingRateio ? 'Confirmar Exclusão do Lote' : 'Confirmar Exclusão')
                  : (existingRateio ? 'Excluir Lote' : 'Excluir')}
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => {
                  setConfirmDelete(false);
                  onClose();
                }} disabled={submitting || deleting}>
                  Fechar
                </Button>
                <Button onClick={handleSave} disabled={submitting || deleting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
