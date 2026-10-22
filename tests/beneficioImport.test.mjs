import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { parseBenefitRows } from '../src/lib/beneficioImport.ts';
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

test('Agregamento and Combustivel retain their spreadsheet parsing', async () => {
  assert.deepEqual(await parseBenefitRows(spreadsheet([
    { CPF: '012.345.678-90', Agregamento: 150 },
  ]), 'agregamento'), [{ cpf: '01234567890', valor: 150 }]);
  assert.deepEqual(await parseBenefitRows(spreadsheet([
    { CPF: '012.345.678-90', Placa: 'abc1234', Valor: 'R$ 250,00' },
  ]), 'combustivel'), [{ cpf: '01234567890', placa: 'ABC1234', valor: 250 }]);
});

test('Flash PDF extraction continues reading a CPF split across lines', () => {
  assert.deepEqual(extractFlashRowsFromPage([
    { text: '012.345.678-', x: 250, y: 100 },
    { text: '90', x: 250, y: 88 },
    { text: 'R$ 1.551,25', x: 510, y: 100 },
  ], 600), [{ cpf: '01234567890', valor: 1551.25 }]);
});
