import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { getCombustivelImportKey, parseBenefitRows, parseCombustivelDate } from '../src/lib/beneficioImport.ts';
import { extractFlashRowsFromPage } from '../src/lib/flashPdfParser.ts';

const spreadsheet = (rows, name = 'flash.xlsx') => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Dados');
  return new File([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], name);
};

test('Flash XLSX reads CPF and numeric or Brazilian currency values', async () => {
  const rows = await parseBenefitRows(spreadsheet([
    { Nome: 'Pessoa A', CPF: '012.345.678-90', Valor: 1551.25 },
    { Nome: 'Pessoa B', CPF: 1234567890, Valor: 'R$ 630,00' },
  ], 'FLASH.XLSX'), 'flash');
  assert.deepEqual(rows, [
    { cpf: '01234567890', valor: 1551.25 },
    { cpf: '01234567890', valor: 630 },
  ]);
});

test('Flash XLSX prefers Total when the report also contains Valor', async () => {
  const rows = await parseBenefitRows(spreadsheet([
    { Nome: 'Pessoa A', CPF: '012.345.678-90', Valor: 'Benefício', Total: 'R$ 1.551,25' },
  ]), 'flash');
  assert.deepEqual(rows, [{ cpf: '01234567890', valor: 1551.25 }]);
});

test('Flash XLSX rejects missing CPF or value headers', async () => {
  for (const row of [{ Nome: 'Pessoa A', Valor: 100 }, { CPF: '01234567890', Nome: 'Pessoa A' }]) {
    await assert.rejects(parseBenefitRows(spreadsheet([row]), 'flash'), /CPF e Valor/);
  }
});

test('Flash rejects unsupported file formats and handles an empty spreadsheet', async () => {
  await assert.rejects(parseBenefitRows(new File(['texto'], 'flash.csv'), 'flash'), /PDF ou XLSX/);
  assert.deepEqual(await parseBenefitRows(spreadsheet([]), 'flash'), []);
});

test('Agregamento retains its spreadsheet parsing and Combustivel includes each row date', async () => {
  assert.deepEqual(await parseBenefitRows(spreadsheet([
    { CPF: '012.345.678-90', Agregamento: 150 },
  ]), 'agregamento'), [{ cpf: '01234567890', valor: 150 }]);
  assert.deepEqual(await parseBenefitRows(spreadsheet([
    { CPF: '012.345.678-90', Placa: 'abc1234', Valor: 'R$ 250,00', Data: '01/09/2026' },
  ]), 'combustivel'), [{ cpf: '01234567890', placa: 'ABC1234', valor: 250, data_beneficio: '2026-09-01' }]);
});

test('Flash PDF extraction continues reading a CPF split across lines', () => {
  assert.deepEqual(extractFlashRowsFromPage([
    { text: '012.345.678-', x: 250, y: 100 },
    { text: '90', x: 250, y: 88 },
    { text: 'R$ 1.551,25', x: 510, y: 100 },
  ], 600), [{ cpf: '01234567890', valor: 1551.25 }]);
});

test('Combustivel reads the ticket report columns and preserves repeated CPFs on different dates', async () => {
  const rows = await parseBenefitRows(spreadsheet([
    { Data: 46264, Veículo: 'ABC1234', 'Valor Total': 40, CPF: '012.345.678-90' },
    { Data: 46265, Veículo: 'ABC1234', 'Valor Total': 40, CPF: '012.345.678-90' },
    { Data: '29/09/2026', Veículo: 'DEF5678', 'Valor Total': 'R$ 1.234,56', CPF: '012.345.678-90' },
  ], 'ticket.xlsx'), 'combustivel');
  assert.deepEqual(rows, [
    { cpf: '01234567890', placa: 'ABC1234', valor: 40, data_beneficio: '2026-08-30' },
    { cpf: '01234567890', placa: 'ABC1234', valor: 40, data_beneficio: '2026-08-31' },
    { cpf: '01234567890', placa: 'DEF5678', valor: 1234.56, data_beneficio: '2026-09-29' },
  ]);
  assert.equal(new Set(rows.map(getCombustivelImportKey)).size, 3);
});

test('Combustivel validates dates without timezone shifts', () => {
  assert.equal(parseCombustivelDate('29/02/2024'), '2024-02-29');
  assert.equal(parseCombustivelDate('2026-09-01'), '2026-09-01');
  assert.equal(parseCombustivelDate(new Date('2026-08-30T00:00:00Z')), '2026-08-30');
  assert.equal(parseCombustivelDate(1, true), '1904-01-02');
  for (const invalid of ['', null, '31/09/2026', '29/02/2026', '2026-13-01', 'texto']) {
    assert.equal(parseCombustivelDate(invalid), '');
  }
});

test('Combustivel requires a valid date in every row and rejects the whole file on error', async () => {
  await assert.rejects(parseBenefitRows(spreadsheet([
    { CPF: '01234567890', Placa: 'ABC1234', Valor: 40 },
  ]), 'combustivel'), /coluna Data/);
  for (const invalidDate of ['', '31/09/2026']) {
    await assert.rejects(parseBenefitRows(spreadsheet([
      { Data: '30/08/2026', CPF: '01234567890', Placa: 'ABC1234', Valor: 40 },
      { Data: invalidDate, CPF: '01234567890', Placa: 'ABC1234', Valor: 40 },
    ]), 'combustivel'), /Linha 3.*Data válida/);
  }
});

test('Combustivel duplicate keys distinguish date, vehicle and value and prevent repeat uploads', () => {
  const row = { cpf: '01234567890', placa: 'ABC1234', valor: 40, data_beneficio: '2026-08-30' };
  const variants = [row, { ...row, data_beneficio: '2026-08-31' }, { ...row, placa: 'DEF5678' }, { ...row, valor: 50 }];
  const existing = new Set(variants.map(getCombustivelImportKey));
  assert.equal(existing.size, 4);
  assert.equal(variants.filter(item => !existing.has(getCombustivelImportKey(item))).length, 0);
  assert.equal(getCombustivelImportKey({ ...row, cpf: '012.345.678-90', placa: 'abc-1234' }), getCombustivelImportKey(row));
});

test('Flash and Agregamento do not use the spreadsheet date', async () => {
  const file = spreadsheet([{ Data: '31/09/2026', CPF: '01234567890', Valor: 40 }]);
  for (const tipo of ['flash', 'agregamento']) {
    assert.deepEqual(await parseBenefitRows(file, tipo), [{ cpf: '01234567890', valor: 40 }]);
  }
});
