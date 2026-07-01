export interface Receita {
  id: string;
  data_recebimento: string;
  nome: string;
  cliente: string;
  descricao: string | null;
  valor: number | null;
  plano_conta_id: string;
  unidade_codigo: string | null;
  unidade_nome: string | null;
  setor_codigo: string | null;
  setor_nome: string | null;
  banco: string | null;
  forma_recebimento: string | null;
  documento: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  conta_codigo: string;
  conta_descricao: string;
  conta_natureza: string | null;
  subgrupo_id: string;
  subgrupo_codigo: string;
  subgrupo_descricao: string;
  grupo_id: string;
  grupo_codigo: string;
  grupo_descricao: string;
  caminho_codigo: string;
  caminho_descricao: string;
  conta_analitica: string;
  grupo_conta: string;
  subgrupo_conta: string;
}

export interface ReceitaFilters {
  dataInicio: string;
  dataFim: string;
  contaAnalitica: string[];
}

export interface ReceitaContaOpcao {
  id: string;
  nome: string;
  codigo: string;
  descricao: string;
  natureza: string | null;
  ordem?: number | null;
}

export interface ReceitaUnidadeOpcao {
  codigo: string;
  unidade: string;
}

export interface ReceitaSetorOpcao {
  codigo: string;
  setor: string;
}

export interface ReceitaKpis {
  totalRegistros: number;
  totalReceitas: number;
  totalDeducoes: number;
  receitaLiquida: number;
}

export interface ReceitaFormPayload {
  data_recebimento: string;
  nome: string;
  cliente: string;
  descricao: string | null;
  valor: number;
  plano_conta_id: string;
  unidade_codigo: string;
  setor_codigo: string;
  banco: string | null;
  forma_recebimento: string | null;
  documento: string | null;
}
