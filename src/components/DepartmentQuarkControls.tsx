import { useCallback, useEffect, useState } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, Link2, Loader2 } from 'lucide-react';

import { DepartmentFilter, DepartmentStatus as Row, departmentPending } from '@/lib/departmentQuark';
type UnitMapping = { quark_unidade_id: string; quark_unidade_nome: string; unidade_codigo: string | null; sync_enabled: boolean };
type TeamMapping = { quark_unidade_id: string; quark_setor_id: string; quark_setor_nome: string; setor_codigo: string | null };
type Run = { status: string; received: number; created: number; updated: number; skipped: number; unmapped: number; conflicts: number; started_at: string; completed_at: string | null; error_message: string | null };
const date = (v: string | null) => v ? new Date(v).toLocaleString('pt-BR') : 'Ainda não realizada';
async function readMappings<T>(table: string): Promise<T[]> {
 const rows: T[] = [];
 for (let start = 0; ; start += 1000) {
  const { data, error } = await externalSupabase.from(table).select('*').order('quark_unidade_id').range(start, start + 999);
  if (error) throw error;
  rows.push(...(data || []) as T[]);
  if ((data || []).length < 1000) return rows;
 }
}
export default function DepartmentQuarkControls({ rows, canEdit, busy, setBusy, filter, setFilter, onRefresh, setores, unidades }: {
 rows: Row[]; canEdit: boolean; busy: boolean; setBusy: (busy: boolean) => void;
 filter: DepartmentFilter; setFilter: (filter: DepartmentFilter) => void; onRefresh: () => Promise<void>;
 setores: { codigo: string; setor: string }[]; unidades: { codigo: string; unidade: string }[];
}) {
 const [syncing, setSyncing] = useState(false);
 const [open, setOpen] = useState(false);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState<string | null>(null);
 const [unitMap, setUnitMap] = useState<UnitMapping[]>([]);
 const [teamMap, setTeamMap] = useState<TeamMapping[]>([]);
 const [lastRun, setLastRun] = useState<Run | null>(null);
 const [lastSuccess, setLastSuccess] = useState<Run | null>(null);
 const refreshRuns = useCallback(async () => {
  const latest = await externalSupabase.from('quark_department_sync_runs').select('*').order('started_at', { ascending: false }).limit(1);
  const success = await externalSupabase.from('quark_department_sync_runs').select('*').eq('status', 'SUCCESS').order('started_at', { ascending: false }).limit(1);
  if (latest.error || success.error) { toast({ title: 'Não foi possível carregar o histórico QuarkRH', variant: 'destructive' }); return; }
  setLastRun(latest.data?.[0] || null); setLastSuccess(success.data?.[0] || null);
 }, []);
 useEffect(() => { void refreshRuns(); }, [refreshRuns]);
 const loadMaps = async () => {
  setLoading(true);
  try { const [u, t] = await Promise.all([readMappings<UnitMapping>('quark_unidade_mapping'), readMappings<TeamMapping>('quark_setor_mapping')]); setUnitMap(u); setTeamMap(t); }
  catch { toast({ title: 'Erro ao carregar mapeamentos', variant: 'destructive' }); }
  finally { setLoading(false); }
 };
 const sync = async () => {
  if (!canEdit || busy) return;
  setBusy(true); setSyncing(true);
  try {
   const { data, error } = await externalSupabase.functions.invoke('sync-quark-department', { body: {} });
   if (error) {
    let message = error.message;
    try { const context = (error as { context?: Response }).context; if (context) message = (await context.json()).error || message; } catch { /* fall back to transport message */ }
    throw new Error(message);
   }
   if (!data?.ok) throw new Error(data?.error || 'Resposta inválida da sincronização.');
   toast({ title: 'Sincronização QuarkRH concluída', description: `${data.received} recebidos · ${data.created} novos · ${data.updated} atualizados · ${data.unmapped} não mapeados · ${data.skipped} ignorados · ${data.conflicts} CPFs conflitantes.` });
   await onRefresh();
  } catch (e) { toast({ title: 'Falha na sincronização', description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' }); }
  finally { await refreshRuns(); setBusy(false); setSyncing(false); }
 };
 const saveMapping = async (kind: 'setor' | 'unidade', unit: string, team: string, code: string) => {
  if (!code || saving || busy) return;
  const key = `${kind}:${unit}:${team}`; setSaving(key); setBusy(true);
  try {
   const { data, error } = await externalSupabase.rpc('save_quark_department_mapping', { p_kind: kind, p_unit: unit, p_team: team, p_code: code });
   if (error) throw error;
   toast({ title: 'Mapeamento salvo', description: `${data} colaborador(es) vinculado(s). A regra será usada nas próximas sincronizações.` });
   await Promise.all([loadMaps(), onRefresh()]);
  } catch { toast({ title: 'Não foi possível salvar o mapeamento', variant: 'destructive' }); }
  finally { setSaving(null); setBusy(false); }
 };
 const toggleUnit = async (unit: UnitMapping) => {
  if (busy) return;
  setBusy(true);
  try {
   const { error } = await externalSupabase.from('quark_unidade_mapping').update({ sync_enabled: !unit.sync_enabled, updated_at: new Date().toISOString() }).eq('quark_unidade_id', unit.quark_unidade_id);
   if (error) throw error;
   await loadMaps();
   toast({ title: unit.sync_enabled ? 'Unidade removida das próximas consultas' : 'Unidade incluída nas próximas consultas', description: 'Os colaboradores existentes foram preservados.' });
  } catch { toast({ title: 'Não foi possível alterar a unidade', variant: 'destructive' }); }
  finally { setBusy(false); }
 };
 const counts = { todos: rows.length, ativos: rows.filter(r => r.ativo === true).length, inativos: rows.filter(r => r.ativo === false).length, pendentes: rows.filter(departmentPending).length, desconhecidos: rows.filter(r => r.ativo == null).length };
 const card = 'rounded-lg border p-3 text-left transition-colors hover:bg-muted/60';
 return <>
  <div className="flex flex-wrap items-center justify-between gap-2">
   <p className="text-xs text-muted-foreground">A sincronização atualiza ou adiciona pelo CPF e nunca exclui colaboradores.</p>
   {canEdit && <div className="flex flex-wrap gap-2">
    <Button variant="outline" className="gap-2" disabled={busy} onClick={() => { setOpen(true); void loadMaps(); }}><Link2 className="h-4 w-4" />Mapear setores e unidades</Button>
    <Button className="gap-2" disabled={busy} onClick={() => void sync()}><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Sincronizando...' : 'Sincronizar QuarkRH'}</Button>
   </div>}
  </div>
  <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
   {([{ key: 'todos', label: 'Total de colaboradores', color: '' }, { key: 'ativos', label: 'Ativos', color: 'text-emerald-600 dark:text-emerald-400' }, { key: 'inativos', label: 'Inativos', color: 'text-red-600 dark:text-red-400' }, { key: 'pendentes', label: 'Não mapeados', color: 'text-amber-600 dark:text-amber-400' }] as const).map(c => <button key={c.key} className={`${card} ${filter === c.key ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}`} onClick={() => setFilter(filter === c.key ? 'todos' : c.key)} aria-pressed={filter === c.key}><span className="block text-xs text-muted-foreground">{c.label}</span><span className={`mt-1 block text-2xl font-semibold ${c.color}`}>{counts[c.key]}</span></button>)}
   <div className="rounded-lg border border-border p-3"><span className="text-xs text-muted-foreground">Última sincronização QuarkRH</span><p className="mt-2 text-sm font-medium">{date(lastSuccess?.completed_at || null)}</p></div>
  </div>
  {counts.desconhecidos > 0 && <button className="self-start text-xs text-muted-foreground underline underline-offset-4" onClick={() => setFilter(filter === 'desconhecidos' ? 'todos' : 'desconhecidos')}>{counts.desconhecidos} colaborador(es) com situação ainda não informada</button>}
  {lastRun && <div className={`rounded-md border p-2 text-xs ${lastRun.status === 'ERROR' ? 'border-red-300 text-red-700 dark:text-red-300' : 'text-muted-foreground'}`}>
   {lastRun.status === 'SUCCESS' ? `${date(lastRun.completed_at)} · ${lastRun.received} recebidos · ${lastRun.created} novos · ${lastRun.updated} atualizados · ${lastRun.unmapped} não mapeados · ${lastRun.skipped} ignorados · ${lastRun.conflicts} CPFs conflitantes · 0 erros` : lastRun.status === 'RUNNING' ? 'Sincronização em andamento.' : `Última tentativa: ${date(lastRun.completed_at)} · ${lastRun.error_message}`}
  </div>}
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
   <DialogHeader><DialogTitle>Mapeamentos QuarkRH → Financeiro</DialogTitle><DialogDescription>Salvar aplica a regra a todos os colaboradores da mesma equipe e unidade. A edição individual na tabela continua disponível; a próxima sincronização usa estas regras.</DialogDescription></DialogHeader>
   {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : <>
    <h3 className="font-semibold">Unidades</h3>
    <p className="text-xs text-muted-foreground">Novas empresas são descobertas no QuarkRH, mas seus colaboradores só serão consultados quando você marcar “Incluir na sincronização”. Sem um código escolhido, aparecerão como não mapeados.</p>
    {unitMap.map(u => <div key={u.quark_unidade_id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
     <div className="text-sm">{u.quark_unidade_nome}<small className="block text-muted-foreground">{u.quark_unidade_id}{!u.unidade_codigo && ' · Não mapeada'}</small><label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={u.sync_enabled} disabled={busy} onChange={() => void toggleUnit(u)} />Incluir na sincronização</label></div>
     <select aria-label={`Unidade ${u.quark_unidade_nome}`} className="rounded-md border bg-background p-2 text-sm" value={u.unidade_codigo || ''} disabled={busy} onChange={e => setUnitMap(prev => prev.map(x => x.quark_unidade_id === u.quark_unidade_id ? { ...x, unidade_codigo: e.target.value } : x))}><option value="">Selecione uma unidade</option>{unidades.map(x => <option key={x.codigo} value={x.codigo}>{x.codigo} — {x.unidade}</option>)}</select>
     <Button disabled={busy || !u.unidade_codigo} onClick={() => void saveMapping('unidade', u.quark_unidade_id, '', u.unidade_codigo!)}>Salvar</Button>
    </div>)}
    <h3 className="mt-3 font-semibold">Setores por equipe do Quark</h3>
    {!teamMap.length && <p className="text-sm text-muted-foreground">As equipes aparecerão após a primeira sincronização.</p>}
    {teamMap.map(t => <div key={`${t.quark_unidade_id}:${t.quark_setor_id}`} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
     <div className="text-sm">{t.quark_setor_nome}<small className="block text-muted-foreground">{unitMap.find(u => u.quark_unidade_id === t.quark_unidade_id)?.quark_unidade_nome || t.quark_unidade_id}{!t.setor_codigo && ' · Não mapeado'}</small></div>
     <select aria-label={`Setor ${t.quark_setor_nome}`} className="rounded-md border bg-background p-2 text-sm" value={t.setor_codigo || ''} disabled={busy} onChange={e => setTeamMap(prev => prev.map(x => x.quark_unidade_id === t.quark_unidade_id && x.quark_setor_id === t.quark_setor_id ? { ...x, setor_codigo: e.target.value } : x))}><option value="">Selecione um setor</option>{setores.map(x => <option key={x.codigo} value={x.codigo}>{x.codigo} — {x.setor}</option>)}</select>
     <Button disabled={busy || !t.setor_codigo} onClick={() => void saveMapping('setor', t.quark_unidade_id, t.quark_setor_id, t.setor_codigo!)}>Salvar</Button>
    </div>)}
   </>}
  </DialogContent></Dialog>
 </>;
}
