import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clock3, Eye, Loader2, RefreshCw, X } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { ApprovalRequest, ApprovalStatus, FINANCIAL_SOURCES, FinancialSource } from '@/lib/financialApprovals';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

const PAGE_SIZE = 25;
const STATUS_LABELS: Record<ApprovalStatus, string> = { pending: 'Pendente de aprovação', approved: 'Aprovado', rejected: 'Recusado' };
const money = (value: number) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR');
const message = (error: unknown) => (error as { message?: string })?.message || 'Não foi possível concluir a operação.';
const COLUMN_LABELS: Record<string, string> = {
  nome: 'Nome', cpf: 'CPF', data: 'Data', data_beneficio: 'Data', data_lancamento: 'Data',
  valor: 'Valor', salario_liquido: 'Salário líquido', favorecido: 'Favorecido', unidade_codigo: 'Unidade',
  setor_codigo: 'Setor', descricao: 'Descrição', tipo_beneficio: 'Tipo de benefício', placa: 'Placa',
};

export default function FinancialApprovals() {
  const { isAdmin } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [status, setStatus] = useState<ApprovalStatus | 'all'>('pending');
  const [source, setSource] = useState<FinancialSource | ''>('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [detailPage, setDetailPage] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const detailRequest = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    let query = externalSupabase.from('financial_approval_requests').select(
      'id,source,requester_id,requester_name,requester_email,file_name,row_count,total_amount,status,created_at,reviewed_at,reviewer_email,review_note,applied_count',
      { count: 'exact' },
    );
    if (status !== 'all') query = query.eq('status', status);
    if (source) query = query.eq('source', source);
    const { data, error: fetchError, count } = await query.order('created_at', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (fetchError) setError(message(fetchError));
    else { setRequests((data || []) as ApprovalRequest[]); setTotal(count || 0); }
    setLoading(false);
  }, [page, source, status]);

  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    const timer = window.setInterval(listener, 60_000);
    window.addEventListener('technet:notifications-refresh', listener);
    return () => { clearInterval(timer); window.removeEventListener('technet:notifications-refresh', listener); };
  }, [refresh]);

  const openDetails = async (request: ApprovalRequest) => {
    const requestNumber = ++detailRequest.current;
    setSelected(request); setRecords([]); setDetailPage(0); setNote(''); setDetailError(''); setDetailLoading(true);
    const { data, error: fetchError } = await externalSupabase.from('financial_approval_requests').select('records').eq('id', request.id).single();
    if (requestNumber !== detailRequest.current) return;
    if (fetchError) setDetailError(message(fetchError));
    else setRecords(data.records as Record<string, unknown>[]);
    setDetailLoading(false);
  };

  const review = async (approve: boolean) => {
    if (!selected || saving) return;
    if (!approve && !note.trim()) { setDetailError('Informe o motivo da recusa.'); return; }
    setSaving(true); setDetailError('');
    const { data, error: reviewError } = await externalSupabase.rpc('review_financial_approval', {
      p_request_id: selected.id, p_approve: approve, p_note: note.trim() || null,
    });
    if (reviewError) setDetailError(message(reviewError));
    else {
      toast({ title: approve ? 'Envio aprovado' : 'Envio recusado', description: approve ? `${data} linha(s) aplicada(s). Linhas duplicadas já existentes são ignoradas.` : 'O envio não alterou os dados financeiros.' });
      setSelected(null);
      window.dispatchEvent(new Event('technet:notifications-refresh'));
      await refresh();
    }
    setSaving(false);
  };

  const columns = Array.from(new Set(records.slice(detailPage * 50, (detailPage + 1) * 50).flatMap(Object.keys)))
    .sort((a, b) => Number(!COLUMN_LABELS[a]) - Number(!COLUMN_LABELS[b]));

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Clock3 className="h-6 w-6 text-primary" />{isAdmin ? 'Aprovações de lançamentos' : 'Meus envios'}</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? 'Revise os lançamentos e arquivos enviados pelo RH.' : 'Acompanhe a aprovação dos seus lançamentos e importações.'}</p></div>
        <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1"><Label htmlFor="approval-status">Status</Label>
          <select id="approval-status" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(0); }}>
            <option value="all">Todos</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></div>
        <div className="min-w-48 flex-1 space-y-1"><Label htmlFor="approval-source">Origem</Label>
          <select id="approval-source" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={source} onChange={event => { setSource(event.target.value as typeof source); setPage(0); }}>
            <option value="">Todas</option>{Object.entries(FINANCIAL_SOURCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></div>
      </div>
      {error ? <p role="alert" className="text-destructive">{error}</p> : loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div> : (
        <div className="max-w-full overflow-x-auto rounded-md border">
          <table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/40 text-left"><tr>{['Enviado por', 'Data do envio', 'Origem / Arquivo', 'Linhas', 'Valor total', 'Status', 'Ação'].map(label => <th key={label} className="p-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{requests.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Nenhum envio encontrado.</td></tr> : requests.map(request => (
              <tr key={request.id} className="border-t"><td className="p-3"><div className="font-semibold">{request.requester_name}</div><div className="text-xs text-muted-foreground">{request.requester_email}</div></td>
                <td className="p-3">{dateTime(request.created_at)}</td><td className="max-w-64 p-3"><div>{FINANCIAL_SOURCES[request.source]}</div><div className="break-words text-xs text-muted-foreground">{request.file_name || 'Lançamento manual'}</div></td>
                <td className="p-3">{request.row_count}</td><td className="whitespace-nowrap p-3">{money(request.total_amount)}</td><td className="p-3"><span className={request.status === 'pending' ? 'text-amber-600 dark:text-amber-400' : request.status === 'approved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>{STATUS_LABELS[request.status]}</span></td>
                <td className="p-3"><Button variant="outline" size="sm" onClick={() => openDetails(request)}><Eye className="mr-2 h-4 w-4" />Revisar</Button></td>
              </tr>))}</tbody></table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3 text-sm"><span>{total} envio(s) • Página {page + 1} de {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span><Button variant="outline" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="outline" disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => setPage(page + 1)}>Próxima</Button></div>
      <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open && !saving) setSelected(null); }}>
        <DialogContent className="flex max-h-[90svh] max-w-6xl flex-col overflow-y-auto" onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onPointerDownOutside={event => { if (saving) event.preventDefault(); }}>
          <DialogHeader><DialogTitle>{selected && FINANCIAL_SOURCES[selected.source]}</DialogTitle><DialogDescription>{selected?.requester_name} • {selected?.requester_email}<br />{selected && dateTime(selected.created_at)} • {selected?.file_name || 'Lançamento manual'}</DialogDescription></DialogHeader>
          {selected && <div className="text-sm">{selected.row_count} linha(s) • <strong>{money(selected.total_amount)}</strong> • {STATUS_LABELS[selected.status]}</div>}
          {detailLoading ? <Loader2 className="mx-auto animate-spin" /> : <>
            <div className="max-h-80 min-h-20 overflow-auto rounded-md border"><table className="w-full text-xs"><thead className="sticky top-0 bg-muted text-left"><tr>{columns.map(column => <th className="whitespace-nowrap p-2" key={column}>{COLUMN_LABELS[column] || column.replace(/_/g, ' ')}</th>)}</tr></thead><tbody>{records.slice(detailPage * 50, (detailPage + 1) * 50).map((record, index) => <tr key={index} className="border-t">{columns.map(column => <td key={column} className="max-w-80 whitespace-nowrap p-2">{record[column] == null ? '-' : String(record[column])}</td>)}</tr>)}</tbody></table></div>
            {records.length > 50 && <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={detailPage === 0} onClick={() => setDetailPage(detailPage - 1)}>Anterior</Button><span className="self-center text-sm">{detailPage + 1} / {Math.ceil(records.length / 50)}</span><Button variant="outline" size="sm" disabled={(detailPage + 1) * 50 >= records.length} onClick={() => setDetailPage(detailPage + 1)}>Próxima</Button></div>}
          </>}
          {selected?.reviewed_at && <p className="text-sm text-muted-foreground">Analisado por {selected.reviewer_email} em {dateTime(selected.reviewed_at)}. {selected.review_note}{selected.status === 'approved' ? ` ${selected.applied_count} linha(s) aplicada(s).` : ''}</p>}
          {detailError && <p role="alert" className="text-sm text-destructive">{detailError}</p>}
          {isAdmin && selected?.status === 'pending' && <div className="space-y-3 border-t pt-3"><Label htmlFor="approval-note">Observação (obrigatória para recusar)</Label><Input id="approval-note" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} disabled={saving} /><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={saving || detailLoading || records.length === 0} onClick={() => review(false)}><X className="mr-2 h-4 w-4" />Recusar</Button><Button disabled={saving || detailLoading || records.length === 0} onClick={() => review(true)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Aprovar envio</Button></div></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
