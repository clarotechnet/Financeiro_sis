export interface FluxoCaixaDia {
  data: string;
  saldoInicial: number;
  receitas: number;
  saldoComEntradas: number;
  pagamentosExatos: number;
  pagamentosProjetados: number;
  totalPagamentos: number;
  saldoTotalProjetado: number;
}

export interface FluxoCaixaResumo {
  saldoAbertura: number;
  totalEntradas: number;
  pagamentosExatos: number;
  pagamentosProjetados: number;
  totalPagamentos: number;
  saldoFinalProjetado: number;
  mediaLiquidaDiaria: number;
}

export interface FluxoCaixaPeriodo {
  dataInicio: string;
  dataFim: string;
}

