import { OpcaoSelect } from '@/types/comissionamento';

export type BeneficioTipo = 'combustivel' | 'agregamento';

export interface BeneficioRegistro {
  tipo: BeneficioTipo;
  tipo_label: string;
  id: string;
  data_beneficio: string;
  cpf: string;
  nome: string;
  unidade_codigo: string | null;
  unidade_nome: string | null;
  setor_codigo: string | null;
  setor_nome: string | null;
  plano_conta_id: string;
  valor: number;
  arquivo_nome: string | null;
  created_at: string;
  updated_at: string;
  conta_codigo: string;
  conta_descricao: string;
  conta_natureza: string;
  conta_analitica: string;
}

export interface BeneficioImportRow {
  cpf: string;
  valor: number;
}

export interface BeneficioImportPayload {
  data_beneficio: string;
  plano_conta_id: string;
  arquivo_nome?: string | null;
  rows: BeneficioImportRow[];
}

export interface BeneficioImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export interface BeneficioFilters {
  dataInicio: string;
  dataFim: string;
  unidade: string[];
  setor: string[];
  contaAnalitica: string[];
  busca: string;
}

export interface BeneficioOpcoes {
  unidades: OpcaoSelect[];
  setores: OpcaoSelect[];
  contas: (OpcaoSelect & { natureza?: string | null })[];
}
