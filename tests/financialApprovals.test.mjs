import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessEmployeeMonitoring, canManageApprovedFinancialData } from '../src/lib/profileRoles.ts';
import { FINANCIAL_SOURCES, formatImportOutcome } from '../src/lib/financialApprovals.ts';

test('RH cannot access monitoring or mutate approved financial records', () => {
  assert.equal(canAccessEmployeeMonitoring('rh'), false);
  assert.equal(canManageApprovedFinancialData('rh'), false);
  assert.equal(canAccessEmployeeMonitoring('admin'), true);
  assert.equal(canAccessEmployeeMonitoring('assistente_financeiro'), true);
  assert.equal(canManageApprovedFinancialData('admin'), true);
  assert.equal(canManageApprovedFinancialData('assistente_financeiro'), false);
  assert.equal(canAccessEmployeeMonitoring(undefined), false);
});

test('all financial submission sources have explicit labels', () => {
  assert.equal(Object.keys(FINANCIAL_SOURCES).length, 5);
  assert.equal(FINANCIAL_SOURCES.dados_financeiro, 'Folha de Pagamento');
  assert.match(FINANCIAL_SOURCES.beneficios_flash, /Flash/);
});

test('pending RH submissions are not reported as imported records', () => {
  const result = formatImportOutcome({ inserted: 0, pendingApproval: 8, skipped: 2, errors: [] });
  assert.match(result, /8 enviado\(s\) para aprovação/);
  assert.doesNotMatch(result, /8 importado/);
  assert.match(formatImportOutcome({ inserted: 8, skipped: 0, errors: [] }), /8 importado/);
});
