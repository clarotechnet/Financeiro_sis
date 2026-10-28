import assert from 'node:assert/strict';
import test from 'node:test';
import { sortFlashBeneficioTipos, validateFlashBeneficioTipo } from '../src/lib/flashBeneficioTipos.ts';

test('Flash type names normalize spaces and preserve the name chosen by the user', () => {
  assert.equal(validateFlashBeneficioTipo('  Flash   Auxílio\tExtra  '), 'Flash Auxílio Extra');
  assert.equal(validateFlashBeneficioTipo('Novo benefício'), 'Novo benefício');
});

test('Flash type names reject blanks, oversized names and the reserved legacy label', () => {
  for (const name of ['', ' ', 'A', 'a'.repeat(101)]) {
    assert.throws(() => validateFlashBeneficioTipo(name), /2 a 100/);
  }
  assert.throws(() => validateFlashBeneficioTipo(' FLASH (legado) '), /reservado/);
});

test('Flash type names reject duplicates regardless of letter case or repeated spaces', () => {
  const options = [{ id: 'Flash Bonificação', nome: 'Flash Bonificação' }];
  assert.throws(() => validateFlashBeneficioTipo('flash  bonificação', options), /Já existe/);
});

test('Flash keeps the original ordering and sorts custom types without mutating input', () => {
  const options = [
    { id: 'Z', nome: 'Flash Z' },
    { id: 'B', nome: 'Flash Bonificação', ordem: 20 },
    { id: 'A', nome: 'Flash Auxílio' },
    { id: 'H', nome: 'Flash Hora Extra', ordem: 10 },
  ];
  assert.deepEqual(sortFlashBeneficioTipos(options).map(option => option.id), ['H', 'B', 'A', 'Z']);
  assert.deepEqual(options.map(option => option.id), ['Z', 'B', 'A', 'H']);
});
