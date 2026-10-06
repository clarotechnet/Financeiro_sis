export type ExcelDepartmentRow = Record<string, unknown> & { __rowNum__?: number };
type Setor = { codigo: string; setor: string };
type Unidade = { codigo: string; unidade: string };
export type DepartmentImportRecord = { nome: string; cpf: string; setor_codigo: string; unidade_codigo: string; ativo?: boolean | null };
export const normalizeDepartmentExcelKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
function cell(row: ExcelDepartmentRow, ...keys: string[]) {
 const entry = Object.entries(row).find(([key]) => keys.includes(normalizeDepartmentExcelKey(key)));
 return entry?.[1];
}
const text = (value: unknown) => value == null ? '' : String(value).trim();
export function prepareDepartmentExcel(rows: ExcelDepartmentRow[], setores: Setor[], unidades: Unidade[]) {
 const records = new Map<string, DepartmentImportRecord>();
 const firstLines = new Map<string, number>();
 const errors: string[] = [];
 let duplicates = 0;
 let empty = 0;
 rows.forEach((row, index) => {
  const line = typeof row.__rowNum__ === 'number' ? row.__rowNum__ + 1 : index + 2;
  if (Object.entries(row).filter(([key]) => key !== '__rowNum__').every(([, value]) => !text(value))) { empty++; return; }
  const nome = text(cell(row, 'nome'));
  const rawCpf = text(cell(row, 'cpf'));
  const digits = rawCpf.replace(/\D/g, '');
  const cpf = digits.length > 0 && digits.length <= 11 ? digits.padStart(11, '0') : '';
  const setorCodigo = text(cell(row, 'setorcodigo', 'codigosetor'));
  const setorNome = text(cell(row, 'setor'));
  const unidadeCodigo = text(cell(row, 'unidadecodigo', 'codigounidade'));
  const unidadeNome = text(cell(row, 'unidade'));
  const setor = setorCodigo
   ? setores.find(s => s.codigo.toLowerCase() === setorCodigo.toLowerCase())
   : setores.find(s => normalizeDepartmentExcelKey(s.setor) === normalizeDepartmentExcelKey(setorNome));
  const unidade = unidadeCodigo
   ? unidades.find(u => u.codigo === unidadeCodigo)
   : unidades.find(u => normalizeDepartmentExcelKey(u.unidade) === normalizeDepartmentExcelKey(unidadeNome));
  const invalid: string[] = [];
  if (!nome) invalid.push('nome vazio');
  if (!cpf || !/^[\d.\-\s]+$/.test(rawCpf)) invalid.push('CPF inválido');
  if (!setor) invalid.push('setor não encontrado no cadastro');
  if (!unidade) invalid.push('unidade não encontrada no cadastro');
  const activeCell = cell(row, 'ativo', 'situacao');
  const activeText = normalizeDepartmentExcelKey(text(activeCell));
  let ativo: boolean | null | undefined;
  if (activeText) {
   if (['true', '1', 'sim', 'ativo'].includes(activeText)) ativo = true;
   else if (['false', '0', 'nao', 'inativo', 'desligado'].includes(activeText)) ativo = false;
   else if (['naoinformado', 'naoinformada'].includes(activeText)) ativo = null;
   else invalid.push('situação inválida; use Ativo ou Inativo');
  }
  if (invalid.length) { errors.push(`Linha ${line}: ${invalid.join(', ')}.`); return; }
  const record: DepartmentImportRecord = { nome, cpf, setor_codigo: setor!.codigo, unidade_codigo: unidade!.codigo, ...(ativo !== undefined ? { ativo } : {}) };
  const previous = records.get(cpf);
  if (previous) {
   if (JSON.stringify(previous) !== JSON.stringify(record)) errors.push(`Linhas ${firstLines.get(cpf)} e ${line}: o mesmo CPF possui dados diferentes.`);
   else duplicates++;
  } else { records.set(cpf, record); firstLines.set(cpf, line); }
 });
 return { records: [...records.values()], errors, duplicates, empty };
}
