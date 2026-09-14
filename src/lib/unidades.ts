const getUnidadeGroup = (nome: string) => {
  const normalized = nome.trim().toLocaleUpperCase('pt-BR');

  if (normalized === 'MATRIZ - SEDE ADMINISTRATIVA') return 0;
  if (normalized.startsWith('FILIAL ')) return 1;
  return 2;
};

const getFilialNumber = (nome: string) => {
  const match = nome.match(/\bFILIAL\s+(\d+)/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

export const sortUnidadesParaFiltro = <T>(
  unidades: T[],
  getCodigo: (unidade: T) => string,
  getNome: (unidade: T) => string,
) => [...unidades].sort((a, b) => {
  const nomeA = getNome(a);
  const nomeB = getNome(b);
  const groupDifference = getUnidadeGroup(nomeA) - getUnidadeGroup(nomeB);

  if (groupDifference !== 0) return groupDifference;

  if (getUnidadeGroup(nomeA) === 1) {
    const filialDifference = getFilialNumber(nomeA) - getFilialNumber(nomeB);
    if (filialDifference !== 0) return filialDifference;
  }

  return getCodigo(a).localeCompare(getCodigo(b), 'pt-BR', { numeric: true });
});
