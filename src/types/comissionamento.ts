// Tipos para o módulo de Lançamentos PIX (mantém nomes legados de comissionamento
// para evitar quebra de imports nos componentes existentes).

export interface LancamentoPix {
  id?: string;
  data_lancamento: string | null;
  nome: string;
  chave_pix: string | null;
  favorecido: string;
  descricao: string | null;
  plano_conta_id?: string | null;
  conta_analitica_codigo?: string | null;
  conta_analitica_descricao?: string | null;
  conta_analitica?: string | null;
  valor: number | null;
  cnpj: string | null;
  unidade_codigo?: string | null;
  unidade_cadastro?: string | null;
  unidade: string | null;
  setor_codigo?: string | null;
  setor_nome?: string | null;
  centro_de_custo: string | null;
  categoria: string | null;
  secao_custeio: string | null;
  centro_custeio: string | null;
  banco_codigo?: string | null;
  banco_cadastro?: string | null;
  banco: string | null;
  forma_pagamento: string | null;
  status_pag: string | null;
  created_at?: string;
  updated_at?: string;
}

// Alias para compatibilidade com componentes legados
export type ComissionamentoData = LancamentoPix;

export interface OpcaoSelect {
  id: string;
  nome: string;
  ordem?: number | null;
}

export interface ComissionamentoFilters {
  cidade: string[];   // unidade
  dataInicio: string;
  dataFim: string;
  status: string[];   // não usado mais (mantido por compat)
  nome: string[];     // favorecido
  frente: string[];   // categoria
  contrato: string[]; // centro_de_custo
  dataExecInicio: string;
  dataExecFim: string;
  descricao: string;        // busca texto
  cnpj: string[];           // multi-select
  contaAnalitica: string[]; // multi-select
  banco: string[];          // multi-select
}

export interface ComissionamentoKPIData {
  total: number;
  totalValor: number;
  porUnidade: { unidade: string; total: number; valor: number }[];
}

export interface TechnicianChartData {
  nome: string;       // unidade
  cidade: string;
  pendente: number;   // não usado
  confirmada: number; // qtd lançamentos
  cancelada: number;  // não usado
  valor?: number;
}

export interface RankingData {
  nome: string;          // favorecido
  totalContratos: number;
  totalValor: number;
}

export interface FrenteKPIData {
  frente: string;              // favorecido
  qtdConsultivo: number;       // qtd lançamentos
  totalGeral: number;          // qtd lançamentos (mesmo)
  pctConfirmada: number;       // % do total geral em valor
  totalTecnicos: number;       // 1 (favorecido único)
  tecAdherente: number;
  pctTecAdherente: number;
  tecNaoVenderam: string[];
  totalValor?: number;
  unidade?: string;
  contasAnaliticas?: string[];
}
