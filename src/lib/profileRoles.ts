export const ROLE_ADMIN = 'admin';
export const ROLE_RH = 'rh';
export const ROLE_FINANCE_ASSISTANT = 'assistente_financeiro';

export type ProfileRole = typeof ROLE_ADMIN | typeof ROLE_RH | typeof ROLE_FINANCE_ASSISTANT;

export const PROFILE_ROLE_OPTIONS: { value: ProfileRole; label: string }[] = [
  { value: ROLE_FINANCE_ASSISTANT, label: 'Assistente Financeiro' },
  { value: ROLE_RH, label: 'RH' },
  { value: ROLE_ADMIN, label: 'Administrador' },
];

export const getProfileRole = (role: string | null | undefined): ProfileRole => {
  if (role === ROLE_ADMIN || role === ROLE_RH || role === ROLE_FINANCE_ASSISTANT) return role;
  return ROLE_FINANCE_ASSISTANT;
};

export const getProfileRoleLabel = (role: string | null | undefined) => (
  PROFILE_ROLE_OPTIONS.find(option => option.value === getProfileRole(role))?.label || 'Assistente Financeiro'
);

export const isFinanceAssistantRole = (role: string | null | undefined) =>
  getProfileRole(role) === ROLE_FINANCE_ASSISTANT;

export const canAccessFinancialReports = (role: string | null | undefined) => {
  const normalizedRole = getProfileRole(role);
  return normalizedRole === ROLE_ADMIN || normalizedRole === ROLE_RH || normalizedRole === ROLE_FINANCE_ASSISTANT;
};

export const canManageExistingFinancialData = (role: string | null | undefined) => {
  const normalizedRole = getProfileRole(role);
  return normalizedRole === ROLE_ADMIN || normalizedRole === ROLE_RH;
};
