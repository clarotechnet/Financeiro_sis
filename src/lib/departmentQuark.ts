export type DepartmentFilter = 'todos' | 'ativos' | 'inativos' | 'pendentes' | 'desconhecidos';
export type DepartmentStatus = { ativo?: boolean | null; quark_setor_pendente?: boolean; quark_unidade_pendente?: boolean };
export const departmentPending = (r: DepartmentStatus) => !!(r.quark_setor_pendente || r.quark_unidade_pendente);
export const departmentMatchesFilter = (r: DepartmentStatus, filter: DepartmentFilter) => filter === 'todos' ||
 (filter === 'ativos' && r.ativo === true) || (filter === 'inativos' && r.ativo === false) ||
 (filter === 'pendentes' && departmentPending(r)) || (filter === 'desconhecidos' && r.ativo == null);
