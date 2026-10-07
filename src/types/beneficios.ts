import { OpcaoSelect } from '@/types/comissionamento';

export type BeneficioTipo = 'combustivel' | 'agregamento' | 'flash';

export const FLASH_BENEFICIO_TIPOS = [
  'Flash Hora Extra',
  'Flash Bonificação',
  'Flash Tec Consultivo',
  'Flash Gatilho',
  'Flash Ind de vendas',
  'Flash Produtividade',
  'Flash VT',
  'Flash VA',
] as const;

export type FlashBeneficioTipo = typeof FLASH_BENEFICIO_TIPOS[number];

export interface BeneficioRegistro {
  tipo: BeneficioTipo;
  tipo_label: string;
  tipo_beneficio: FlashBeneficioTipo | null;
  id: string;
  data_beneficio: string;
  cpf: string;
  placa: string | null;
  nome: string;
  unidade_codigo: string | null;
  unidade_nome: string | null;
  setor_codigo: string | null;
  setor_nome: string | null;
  plano_conta_id: string | null;
  valor: number;
  arquivo_nome: string | null;
  created_at: string;
  updated_at: string;
  conta_codigo: string | null;
  conta_descricao: string | null;
  conta_natureza: string | null;
  conta_analitica: string | null;
}

export interface BeneficioImportRow {
  cpf: string;
  placa?: string | null;
  valor: number;
}

export interface BeneficioImportPayload {
  data_beneficio: string;
  tipo_beneficio?: FlashBeneficioTipo | null;
  arquivo_nome?: string | null;
  rows: BeneficioImportRow[];
}

export interface BeneficioImportResult {
  inserted: number;
  skipped: number;
  duplicateCount: number;
  duplicateCpfs: string[];
  errors: string[];
}

export interface BeneficioFilters {
  dataInicio: string;
  dataFim: string;
  unidade: string[];
  setor: string[];
  nome: string[];
  tipoBeneficio: string[];
  placa: string;
  busca: string;
}

export interface BeneficioOpcoes {
  unidades: OpcaoSelect[];
  setores: OpcaoSelect[];
}
