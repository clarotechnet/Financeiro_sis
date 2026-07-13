import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useComissionamento } from '@/hooks/useComissionamento';
import { ComissionamentoFilters } from '@/components/comissionamento/ComissionamentoFilters';
import { ComissionamentoKPIs } from '@/components/comissionamento/ComissionamentoKPIs';
import { ComissionamentoCharts } from '@/components/comissionamento/ComissionamentoCharts';
import { ComissionamentoTable } from '@/components/comissionamento/ComissionamentoTable';
import { ComissionamentoFrentes } from '@/components/comissionamento/ComissionamentoFrentes';
import { ComissionamentoValores } from '@/components/comissionamento/ComissionamentoValores';
import { LoadingSpinner } from '@/components/comissionamento/LoadingSpinner';
import { useAuth } from '@/contexts/useAuth';
import { BarChart3, DollarSign, FileText, Layers, Loader2 } from 'lucide-react';
import { canManageExistingFinancialData } from '@/lib/profileRoles';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { LancamentoPix } from '@/types/comissionamento';

const fmtBRL = (value: number | null | undefined) =>
  value != null ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';

const fmtDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
};

const getLancamentoUnidade = (record: LancamentoPix) =>
  record.unidade_cadastro || record.unidade || '-';

const getLancamentoCentroCusto = (record: LancamentoPix) =>
  record.setor_nome || record.centro_de_custo || '-';

const getLancamentoBanco = (record: LancamentoPix) =>
  record.banco_cadastro || record.banco || '-';

const NotificationField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 text-sm font-semibold text-foreground break-words">{value || '-'}</div>
  </div>
);

const Comissionamento: React.FC = () => {
  const hook = useComissionamento();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') || 'frentes';
  const notificacaoDesde = params.get('notificacaoDesde');
  const notificacaoLancamentoId = params.get('notificacaoLancamentoId');
  const [notificationRecords, setNotificationRecords] = useState<LancamentoPix[]>([]);
  const [isLoadingNotificationRecords, setIsLoadingNotificationRecords] = useState(false);
  const { profile } = useAuth();
  const canManageRecords = canManageExistingFinancialData(profile?.role);
  const isDashboard = activeTab === 'frentes';
  const pageMeta = {
    frentes: {
      title: 'Dashboard',
      subtitle: 'Visão geral das solicitações de pagamento',
      icon: Layers,
      gradient: 'linear-gradient(135deg, #22c55e 0%, #0f766e 100%)',
    },
    kpis: {
      title: 'Inclusão de Pagamentos',
      subtitle: 'Controle de solicitações de pagamento',
      icon: DollarSign,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    charts: {
      title: 'KPIs',
      subtitle: 'Indicadores das solicitações de pagamento',
      icon: BarChart3,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    table: {
      title: 'Lançamentos',
      subtitle: 'Relatórios e dados detalhados de pagamentos',
      icon: FileText,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    valores: {
      title: 'Valores',
      subtitle: 'Resumo financeiro por favorecido',
      icon: DollarSign,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
  }[activeTab] || {
    title: 'Relatórios',
    subtitle: 'Controle de pagamento',
    icon: FileText,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  };
  const HeaderIcon = pageMeta.icon;

  useEffect(() => {
    hook.fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    if (notificacaoDesde) {
      return () => {
        active = false;
      };
    }

    if (!notificacaoLancamentoId) {
      setNotificationRecords([]);
      setIsLoadingNotificationRecords(false);
      return () => {
        active = false;
      };
    }

    const existingRecord = hook.allData.find(record => record.id === notificacaoLancamentoId);
    if (existingRecord) {
      setNotificationRecords([existingRecord]);
      setIsLoadingNotificationRecords(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingNotificationRecords(true);
    Promise.resolve(externalSupabase
      .from('vw_lancamentos_pix_com_conta_analitica')
      .select('*')
      .eq('id', notificacaoLancamentoId)
      .maybeSingle())
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Erro ao buscar lançamento da notificação:', error);
          setNotificationRecords([]);
          return;
        }
        setNotificationRecords(data ? [data as LancamentoPix] : []);
      })
      .finally(() => {
        if (active) setIsLoadingNotificationRecords(false);
      });

    return () => {
      active = false;
    };
  }, [hook.allData, notificacaoDesde, notificacaoLancamentoId]);

  useEffect(() => {
    let active = true;

    if (!notificacaoDesde) {
      return () => {
        active = false;
      };
    }

    setIsLoadingNotificationRecords(true);
    Promise.resolve(externalSupabase
      .from('vw_lancamentos_pix_com_conta_analitica')
      .select('*')
      .gt('created_at', notificacaoDesde)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Erro ao buscar lancamentos da notificacao:', error);
          setNotificationRecords([]);
          return;
        }
        setNotificationRecords((data || []) as LancamentoPix[]);
      })
      .finally(() => {
        if (active) setIsLoadingNotificationRecords(false);
      });

    return () => {
      active = false;
    };
  }, [notificacaoDesde]);

  const hasData = hook.allData.length > 0;

  const closeNotificationDialog = () => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete('notificacaoLancamentoId');
    nextParams.delete('notificacaoDesde');
    setParams(nextParams, { replace: true });
  };

  const hasNotificationDialog = Boolean(notificacaoDesde || notificacaoLancamentoId);
  const notificationTotal = notificationRecords.reduce((total, record) => total + (record.valor || 0), 0);
  const notificationRecord = notificationRecords[0] || null;

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shadow-glow"
            style={{ background: pageMeta.gradient }}
          >
            <HeaderIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground">{pageMeta.title}</h1>
            <p className="text-sm text-muted-foreground">{pageMeta.subtitle}</p>
          </div>
        </div>

        {hook.error && (
          <div className="alert alert-error">
            <span>⚠️ {hook.error}</span>
          </div>
        )}

        <ComissionamentoFilters
          filters={hook.filters}
          setFilters={hook.setFilters}
          clearFilters={hook.clearFilters}
          uniqueCidades={hook.uniqueCidades}
          uniqueNomes={hook.uniqueNomes}
          totalFiltered={hook.data.length}
          onManualSubmit={hook.submitManualEntry}
          filteredData={hook.data}
          opcoes={hook.opcoes}
          onImportExcel={hook.importExcel}
          showActions={!isDashboard}
          showGeneralSearch={activeTab === 'table'}
        />

        {hook.isLoading && !hasData && (
          <LoadingSpinner message="Carregando lançamentos..." />
        )}

        {hasData && (
          <div className="tab-content relative z-0">
            {activeTab === 'kpis' && <ComissionamentoKPIs kpis={hook.kpis} lancamentos={hook.data} />}
            {activeTab === 'charts' && (
              <ComissionamentoCharts chartData={hook.chartData} ranking={hook.ranking} frentesData={hook.frentesData} />
            )}
            {activeTab === 'frentes' && (
              <ComissionamentoFrentes
                frentesData={hook.frentesData}
                selectedFrente={hook.filters.frente[0] || ''}
                lancamentos={hook.data}
              />
            )}
            {activeTab === 'table' && (
              <ComissionamentoTable
                data={hook.data}
                onUpdate={hook.updateRecord}
                onDelete={hook.deleteRecord}
                opcoes={hook.opcoes}
                canManage={canManageRecords}
              />
            )}
            {activeTab === 'valores' && <ComissionamentoValores data={hook.data} />}
          </div>
        )}

        {!hook.isLoading && !hasData && !hook.error && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              Clique em "Novo Lançamento" para começar.
            </p>
          </div>
        )}

        <Dialog open={hasNotificationDialog} onOpenChange={(open) => {
          if (!open) closeNotificationDialog();
        }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Lançamentos da Notificação</DialogTitle>
            </DialogHeader>

            {isLoadingNotificationRecords ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando lançamentos...
              </div>
            ) : notificationRecord ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Novos lançamentos</div>
                  <div className="mt-1 text-lg font-bold text-foreground">
                    {notificationRecords.length} lançamento(s) desde a última visualização
                  </div>
                  <div className="mt-1 text-2xl font-black text-primary">{fmtBRL(notificationTotal)}</div>
                </div>

                <div className={notificationRecords.length > 1 ? 'hidden' : 'grid grid-cols-1 gap-3 md:grid-cols-2'}>
                  <NotificationField label="Data" value={fmtDate(notificationRecord.data_lancamento)} />
                  <NotificationField label="Status" value={notificationRecord.status_pag || '-'} />
                  <NotificationField label="Unidade" value={getLancamentoUnidade(notificationRecord)} />
                  <NotificationField label="Centro de Custo" value={getLancamentoCentroCusto(notificationRecord)} />
                  <NotificationField label="Conta Analítica" value={notificationRecord.conta_analitica || '-'} />
                  <NotificationField label="Banco" value={getLancamentoBanco(notificationRecord)} />
                  <NotificationField label="Chave PIX" value={notificationRecord.chave_pix || '-'} />
                  <NotificationField label="Observação" value={notificationRecord.descricao || '-'} />
                </div>

                {notificationRecords.length > 1 && (
                  <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                    {notificationRecords.map((record) => (
                      <div key={record.id || `${record.data_lancamento}-${record.favorecido}-${record.valor}`} className="rounded-lg border border-border bg-card px-3 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-foreground break-words">{record.favorecido || '-'}</div>
                            <div className="text-xs text-muted-foreground">
                              {fmtDate(record.data_lancamento)} - {getLancamentoUnidade(record)}
                            </div>
                          </div>
                          <div className="text-base font-black text-primary">{fmtBRL(record.valor)}</div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <NotificationField label="Centro de Custo" value={getLancamentoCentroCusto(record)} />
                          <NotificationField label="Conta Analítica" value={record.conta_analitica || '-'} />
                          <NotificationField label="Banco" value={getLancamentoBanco(record)} />
                          <NotificationField label="Status" value={record.status_pag || '-'} />
                          <NotificationField label="Chave PIX" value={record.chave_pix || '-'} />
                          <NotificationField label="Observação" value={record.descricao || '-'} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Não foi possível localizar esse lançamento. Ele pode ter sido removido ou você pode não ter permissão para visualizar.
              </div>
            )}

            <DialogFooter>
              <Button type="button" onClick={closeNotificationDialog}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Comissionamento;
