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
import { DollarSign } from 'lucide-react';

const Comissionamento: React.FC = () => {
  const hook = useComissionamento();
  const [params] = useSearchParams();
  const activeTab = params.get('tab') || 'kpis';
  const { isAdmin } = useAuth();

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
            style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
          >
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground">SOLICITAÇÃO DE PAGAMENTO</h1>
            <p className="text-sm text-muted-foreground">Controle de Pagamento</p>
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
        />

        {hook.isLoading && !hasData && (
          <LoadingSpinner message="Carregando lançamentos PIX..." />
        )}

        {hasData && isAdmin && (
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
