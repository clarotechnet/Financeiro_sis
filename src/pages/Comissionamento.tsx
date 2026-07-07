import React, { useEffect } from 'react';
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
import { BarChart3, DollarSign, FileText, Layers } from 'lucide-react';
import { canManageExistingFinancialData } from '@/lib/profileRoles';

const Comissionamento: React.FC = () => {
  const hook = useComissionamento();
  const [params] = useSearchParams();
  const activeTab = params.get('tab') || 'frentes';
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

  const hasData = hook.allData.length > 0;

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
        />

        {hook.isLoading && !hasData && (
          <LoadingSpinner message="Carregando lançamentos..." />
        )}

        {hasData && (
          <div className="tab-content relative z-0">
            {activeTab === 'kpis' && <ComissionamentoKPIs kpis={hook.kpis} />}
            {activeTab === 'charts' && (
              <ComissionamentoCharts chartData={hook.chartData} ranking={hook.ranking} frentesData={hook.frentesData} />
            )}
            {activeTab === 'frentes' && (
              <ComissionamentoFrentes
                frentesData={hook.frentesData}
                selectedFrente={hook.filters.frente[0] || ''}
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
      </div>
    </div>
  );
};

export default Comissionamento;
