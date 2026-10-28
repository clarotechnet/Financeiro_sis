import type { OpcaoSelect } from '@/types/comissionamento';

export const validateFlashBeneficioTipo = (value: string, existing: OpcaoSelect[] = []): string => {
  const nome = value.trim().replace(/\s+/g, ' ');
  if (nome.length < 2 || nome.length > 100) {
    throw new Error('Informe um nome com 2 a 100 caracteres.');
  }
  const normalized = nome.toLocaleLowerCase('pt-BR');
  if (normalized === 'flash (legado)') {
    throw new Error('Esse nome é reservado aos registros antigos sem tipo.');
  }
  if (existing.some(option => option.nome.toLocaleLowerCase('pt-BR') === normalized)) {
    throw new Error('Já existe um tipo de benefício com esse nome.');
  }
  return nome;
};

export const sortFlashBeneficioTipos = (options: OpcaoSelect[]): OpcaoSelect[] =>
  [...options].sort((a, b) => (a.ordem ?? 1000) - (b.ordem ?? 1000) || a.nome.localeCompare(b.nome, 'pt-BR'));
