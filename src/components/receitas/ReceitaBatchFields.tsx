import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ReceitaContaOpcao, ReceitaSetorOpcao, ReceitaUnidadeOpcao } from '@/types/receitas';
import { buildMonthlyDates, MAX_MONTHLY_OCCURRENCES } from '@/utils/monthlyDates';

export interface ReceitaRateioForm {
  localId: string;
  id?: string;
  cliente: string;
  unidade_codigo: string;
  setor_codigo: string;
  plano_conta_id: string;
  valor: string;
}

export const createReceitaRateio = (seed: Partial<ReceitaRateioForm> = {}): ReceitaRateioForm => ({
  localId: crypto.randomUUID(), cliente: '', unidade_codigo: '', setor_codigo: '', plano_conta_id: '', valor: '', ...seed,
});

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  multiple: boolean;
  onMultipleChange: (value: boolean) => void;
  quantity: number;
  onQuantityChange: (value: number) => void;
  startDate: string;
  totalCents: number;
  split: boolean;
  onSplitChange: (value: boolean) => void;
  lockedSplit: boolean;
  items: ReceitaRateioForm[];
  onItemsChange: (items: ReceitaRateioForm[]) => void;
  seed: Partial<ReceitaRateioForm>;
  contas: ReceitaContaOpcao[];
  unidades: ReceitaUnidadeOpcao[];
  setores: ReceitaSetorOpcao[];
  editing: boolean;
}

export function ReceitaBatchFields(props: Props) {
  const { multiple, quantity, split, items, totalCents } = props;
  const sum = items.reduce((total, item) => total + Number(item.valor || 0), 0);
  const difference = totalCents - sum;
  const dates = props.startDate ? buildMonthlyDates(props.startDate, quantity) : [];
  const update = (localId: string, field: keyof ReceitaRateioForm, value: string) =>
    props.onItemsChange(items.map(item => item.localId === localId ? { ...item, [field]: value } : item));
  const selectClass = 'w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground';

  return <>
    <section className="space-y-3 md:col-span-2 rounded-lg border border-border bg-muted/20 p-4">
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={multiple} onChange={event => props.onMultipleChange(event.target.checked)} />
        Múltiplas Receitas
      </label>
      {multiple && <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm">Quantidade de lançamentos *</label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" title="Diminuir quantidade" aria-label="Diminuir quantidade" disabled={quantity <= 2} onClick={() => props.onQuantityChange(quantity - 1)}><Minus /></Button>
            <Input aria-label="Quantidade de lançamentos mensais" type="number" min={2} max={MAX_MONTHLY_OCCURRENCES} value={quantity} onChange={event => props.onQuantityChange(Number(event.target.value))} className="min-w-0 text-center" />
            <Button type="button" variant="outline" size="icon" title="Aumentar quantidade" aria-label="Aumentar quantidade" disabled={quantity >= MAX_MONTHLY_OCCURRENCES} onClick={() => props.onQuantityChange(quantity + 1)}><Plus /></Button>
          </div>
        </div>
        <div className="text-sm">
          <div className="font-semibold">{quantity} lançamentos mensais de {money(totalCents)}</div>
          <div className="text-muted-foreground">Total previsto: {money(totalCents * quantity)}</div>
          {dates.length > 0 && <div className="text-xs text-muted-foreground">{dates[0].split('-').reverse().join('/')} até {dates[dates.length - 1].split('-').reverse().join('/')}</div>}
          {props.editing && <p className="text-xs text-muted-foreground">Atualiza este lançamento e cria {quantity - 1} novos meses. Outros meses já existentes não são alterados.</p>}
        </div>
      </div>}
    </section>
    <section className="space-y-4 md:col-span-2 rounded-lg border border-border bg-muted/20 p-4">
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={split} disabled={props.lockedSplit} onChange={event => props.onSplitChange(event.target.checked)} />
        Múltiplos Rateios
      </label>
      {split && <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
          <div><span className="text-xs text-muted-foreground">Valor geral</span><div className="font-bold">{money(totalCents)}</div></div>
          <div><span className="text-xs text-muted-foreground">Soma do rateio</span><div className="font-bold">{money(sum)}</div></div>
          <div><span className="text-xs text-muted-foreground">Diferença</span><div className={`font-bold ${difference === 0 ? 'text-emerald-500' : 'text-destructive'}`}>{money(difference)}</div></div>
        </div>
        {items.map((item, index) => <fieldset key={item.localId} className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Rateio {index + 1}</legend>
          <label className="min-w-0 space-y-1 text-sm">Cliente / Origem *<Input value={item.cliente} onChange={event => update(item.localId, 'cliente', event.target.value)} /></label>
          <label className="min-w-0 space-y-1 text-sm">Valor *<Input inputMode="decimal" value={item.valor ? money(Number(item.valor)) : ''} placeholder="R$ 0,00" onChange={event => update(item.localId, 'valor', event.target.value.replace(/\D/g, ''))} /></label>
          <label className="min-w-0 space-y-1 text-sm">Unidade *<select className={selectClass} value={item.unidade_codigo} onChange={event => update(item.localId, 'unidade_codigo', event.target.value)}><option value="">Selecione...</option>{props.unidades.map(option => <option key={option.codigo} value={option.codigo}>{option.codigo} - {option.unidade}</option>)}</select></label>
          <label className="min-w-0 space-y-1 text-sm">Centro de Custo *<select className={selectClass} value={item.setor_codigo} onChange={event => update(item.localId, 'setor_codigo', event.target.value)}><option value="">Selecione...</option>{props.setores.map(option => <option key={option.codigo} value={option.codigo}>{option.setor}</option>)}</select></label>
          <label className="min-w-0 space-y-1 text-sm md:col-span-2">Conta Analítica *<select className={selectClass} value={item.plano_conta_id} onChange={event => update(item.localId, 'plano_conta_id', event.target.value)}><option value="">Selecione...</option>{props.contas.map(option => <option key={option.id} value={option.id}>{option.nome}</option>)}</select></label>
          <div className="md:col-span-2 flex justify-end"><Button type="button" variant="ghost" size="icon" disabled={items.length <= 1} title={`Remover rateio ${index + 1}`} aria-label={`Remover rateio ${index + 1}`} onClick={() => props.onItemsChange(items.filter(row => row.localId !== item.localId))}><Trash2 className="text-destructive" /></Button></div>
        </fieldset>)}
        <Button type="button" variant="outline" size="sm" disabled={items.length >= 100} onClick={() => props.onItemsChange([...items, createReceitaRateio(props.seed)])} className="gap-2"><Plus className="h-4 w-4" />Adicionar rateio</Button>
        {difference !== 0 && <p className="text-xs text-destructive">A soma dos rateios deve ser igual ao valor geral.</p>}
      </>}
    </section>
  </>;
}
