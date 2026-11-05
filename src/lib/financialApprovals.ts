export const FINANCIAL_SOURCES = {
  lancamentos_pix: 'Pagamentos',
  dados_financeiro: 'Folha de Pagamento',
  beneficios_combustivel: 'Benefícios - Combustível',
  beneficios_agregamento: 'Benefícios - Agregamento',
  beneficios_flash: 'Benefícios - Flash',
} as const;

export type FinancialSource = keyof typeof FINANCIAL_SOURCES;
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export interface ApprovalRequest {
  id: string;
  source: FinancialSource;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  file_name: string | null;
  row_count: number;
  total_amount: number;
  status: ApprovalStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewer_email: string | null;
  review_note: string | null;
  applied_count: number | null;
}
export interface ImportOutcome {
  inserted: number;
  skipped: number;
  errors: string[];
  pendingApproval?: number;
}
export const formatImportOutcome = (result: ImportOutcome) =>
  `${result.pendingApproval ? `${result.pendingApproval} enviado(s) para aprovação do administrador` : `${result.inserted} importado(s)`}, ${result.skipped} ignorado(s).${result.errors.length ? ` ${result.errors[0]}` : ''}`;
