import type { Receita } from '@/types/receitas';

export const receitaCents = (value: number | null | undefined) => Math.round(Number(value || 0) * 100);

export const getReceitaLote = (receita: Receita | null, receitas: Receita[], editarLote: boolean) => {
  if (!receita) return [];
  if (!editarLote || !receita.rateio_lote_id) return [receita];
  return receitas.filter(row => row.rateio_lote_id === receita.rateio_lote_id && !row.receita_pai_id)
    .sort((a, b) => (a.rateio_item_ordem || 0) - (b.rateio_item_ordem || 0));
};

export const getReceitaDeducoes = (items: Receita[], receitas: Receita[]) => {
  const ids = new Set(items.map(item => item.id));
  const grouped = new Map<string, Receita>();
  for (const row of receitas) {
    if (!row.receita_pai_id || !ids.has(row.receita_pai_id)) continue;
    const key = JSON.stringify([row.plano_conta_id, row.descricao || '']);
    const current = grouped.get(key);
    grouped.set(key, current
      ? { ...current, valor: (receitaCents(current.valor) + receitaCents(row.valor)) / 100 }
      : { ...row });
  }
  return [...grouped.values()];
};

export const groupReceitas = (rows: Receita[]) => {
  const groups = new Map<string, { key: string; row: Receita; items: Receita[]; isLote: boolean }>();
  for (const row of rows) {
    const isLote = Boolean(row.rateio_lote_id && !row.receita_pai_id);
    const key = isLote ? `lote-${row.rateio_lote_id}` : row.id;
    const existing = groups.get(key);
    if (existing) existing.items.push(row);
    else groups.set(key, { key, row, items: [row], isLote });
  }
  return [...groups.values()];
};
