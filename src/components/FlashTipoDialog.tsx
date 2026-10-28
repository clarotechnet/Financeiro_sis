import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (nome: string) => Promise<void>;
}

export default function FlashTipoDialog({ open, onClose, onCreate }: Props) {
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setNome('');
    setError('');
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onCreate(nome);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar o tipo de benefício.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo tipo de benefício Flash</DialogTitle>
          <DialogDescription className="sr-only">Cadastro de tipos para uso exclusivo na aba Flash.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="novo-flash-tipo">Nome do tipo *</Label>
            <Input id="novo-flash-tipo" value={nome} onChange={event => setNome(event.target.value)} placeholder="Ex.: Flash Auxílio" maxLength={100} required disabled={saving} aria-invalid={!!error} aria-describedby={error ? 'novo-flash-tipo-error' : undefined} />
          </div>
          {error && <p id="novo-flash-tipo-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving || !nome.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
