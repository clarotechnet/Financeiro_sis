import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, Trash2 } from 'lucide-react';
import { LancamentoPix, OpcaoSelect } from '@/types/comissionamento';

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
  opcoes: OpcoesData;
}

const formatDateForInput = (val: string | null) => {
  if (!val) return '';
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? val.substring(0, 10) : '';
};

// Resolve nome -> id em uma lista de opções
const findIdByName = (opts: OpcaoSelect[], name: string | null): string => {
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

export const ComissionamentoEditDialog: React.FC<Props> = ({ open, onClose, onSave, onDelete, record, opcoes }) => {
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({
        data_lancamento: formatDateForInput(record.data_lancamento),
        nome: record.nome || '',
        chave_pix: record.chave_pix || '',
        favorecido: record.favorecido || '',
        descricao: record.descricao || '',
        valor: record.valor != null ? String(record.valor) : '',
        banco: record.banco || '',
        banco_codigo: record.banco_codigo || findIdByName(opcoes.bancos, record.banco),
        status_pag: record.status_pag || '',
        unidade_id: record.unidade_codigo || findIdByName(opcoes.unidade, record.unidade),
        centro_de_custo_id: record.setor_codigo || findIdByName(opcoes.centro_de_custo, record.centro_de_custo),
        plano_conta_id: record.plano_conta_id || '',
      });
      setError('');
      setSuccess(false);
      setConfirmDelete(false);
    }
  }, [record, opcoes]);

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!record?.id) return;
    setSubmitting(true);
    setError('');
    try {
      const bancoSelecionado = opcoes.bancos.find(option => option.id === form.banco_codigo);
      const updates: Record<string, any> = {
        data_lancamento: form.data_lancamento || null,
        nome: form.nome,
        chave_pix: form.chave_pix,
        favorecido: form.favorecido,
        descricao: form.descricao || null,
        valor: form.valor ? parseFloat(form.valor.replace(/[^\d.,\-]/g, '').replace(',', '.')) : null,
        banco_codigo: bancoSelecionado?.id || null,
        banco: bancoSelecionado?.nome || form.banco || null,
        status_pag: form.status_pag || null,
        unidade_id: null,
        unidade_codigo: form.unidade_id || null,
        centro_de_custo_id: null,
        setor_codigo: form.centro_de_custo_id || null,
        plano_conta_id: form.plano_conta_id || null,
      };
      await onSave(record.id, updates);
      setSuccessMsg('Registro atualizado com sucesso!');
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1200);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!record?.id) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    setError('');
    try {
      await onDelete(record.id);
      setSuccessMsg('Registro excluído com sucesso!');
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1200);
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const selectClass = "w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground text-sm";

  const renderSelect = (field: string, label: string, opts: OpcaoSelect[]) => (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      <select className={selectClass} value={form[field] || ''} onChange={e => set(field, e.target.value)}>
        <option value="">Selecione...</option>
        {opts.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setConfirmDelete(false); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento PIX</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="w-12 h-12 text-primary" />
            <p className="text-lg font-semibold text-foreground">{successMsg}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Data</Label>
                <Input type="date" value={form.data_lancamento || ''} onChange={e => set('data_lancamento', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Nome</Label>
                <Input value={form.nome || ''} onChange={e => set('nome', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Chave PIX</Label>
                <Input value={form.chave_pix || ''} onChange={e => set('chave_pix', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Favorecido</Label>
                <Input value={form.favorecido || ''} onChange={e => set('favorecido', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Valor</Label>
                <Input value={form.valor || ''} onChange={e => set('valor', e.target.value)} />
              </div>
              {renderSelect('unidade_id', 'Unidade', opcoes.unidade)}
              {renderSelect('centro_de_custo_id', 'Centro de Custo', opcoes.centro_de_custo)}
              {renderSelect('plano_conta_id', 'Conta Analítica', opcoes.plano_contas)}
              {renderSelect('banco_codigo', 'Banco', opcoes.bancos)}
              <div className="space-y-1">
                <Label className="text-sm font-medium">Status Pagamento</Label>
                <select className={selectClass} value={form.status_pag || ''} onChange={e => set('status_pag', e.target.value)}>
                  <option value="">Selecione...</option>
                  <option value="PAGO">PAGO</option>
                  <option value="A PAGAR">A PAGAR</option>
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm text-muted-foreground">Observação</Label>
                <Input value={form.descricao || ''} onChange={e => set('descricao', e.target.value)} />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="flex gap-2 sm:gap-2 sm:justify-between w-full">
              <Button variant="destructive" onClick={handleDelete} disabled={submitting || deleting} className="mr-auto">
                {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Trash2 className="w-4 h-4 mr-1" />
                {confirmDelete ? 'Confirmar Exclusão' : 'Excluir'}
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setConfirmDelete(false); onClose(); }} disabled={submitting || deleting}>Fechar</Button>
                <Button onClick={handleSave} disabled={submitting || deleting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
