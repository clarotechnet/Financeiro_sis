export type Obj = Record<string, unknown>;
export const obj = (v: unknown): Obj => v && typeof v==='object' && !Array.isArray(v) ? v as Obj : {};
export const str = (v: unknown) => typeof v==='string'||typeof v==='number' ? String(v).trim() : '';
export const first = (...v: unknown[]) => v.map(str).find(Boolean)||'';
export function list(v: unknown): Obj[] {
 if(Array.isArray(v)) return v.filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
 const o=obj(v);
 for(const k of ['dados','content','data','items','results','result','records','registros','colaboradores','unidades','lista']) if(Array.isArray(o[k])) return list(o[k]);
 for(const value of Object.values(o)) {const a=list(value);if(a.length)return a;}
 return [];
}
export function cpf(v: unknown) {
 const raw=str(v).replace(/\D/g,''); if(!raw||raw.length>11)return '';
 const c=raw.padStart(11,'0');if(/^(\d)\1{10}$/.test(c))return '';
 const digit=(n:number)=>{let s=0;for(let i=0;i<n;i++)s+=Number(c[i])*(n+1-i);const r=(s*10)%11;return r===10?0:r;};
 return digit(9)===Number(c[9])&&digit(10)===Number(c[10])?c:'';
}
export function active(r: Obj): boolean|null {
 const v=r.ativo;
 if(v===false||v===0||['false','0','nao','não','inativo'].includes(str(v).toLowerCase()))return false;
 const situation=first(obj(r.situacao).denominacao,r.situacao).toLowerCase();
 if(/deslig|inativ|demit/.test(situation)||str(r.dataDesligamento))return false;
 if(v===true||v===1||['true','1','sim','ativo'].includes(str(v).toLowerCase())||situation==='ativo')return true;
 return null;
}
export function normalize(r: Obj, unitId: string, unitName: string) {
 const person=obj(r.pessoa), team=obj(r.equipe);
 const document=cpf(person.cpfCnpj??r.cpf??r.cpfCnpj), name=first(person.nome,r.nome,r.nomeCompleto);
 if(!document||name.length<2)return null;
 const teamName=first(team.denominacao,r.setor,r.departamento)||'Equipe não informada';
 return {nome:name,cpf:document,ativo:active(r),quark_colaborador_id:first(r.id,r.colaboradorId),
 quark_setor_id:first(team.id)||`nome:${teamName.toLocaleLowerCase('pt-BR')}`,
 quark_setor_nome:teamName,quark_unidade_id:unitId,quark_unidade_nome:unitName};
}
export type Employee=NonNullable<ReturnType<typeof normalize>>;
export function deduplicate(rows:Employee[]) {
 const groups=new Map<string,Employee[]>();for(const r of rows)groups.set(r.cpf,[...(groups.get(r.cpf)||[]),r]);
 const records:Employee[]=[];let conflicts=0;
 for(const group of groups.values()) {
  const activeRows=group.filter(x=>x.ativo===true),candidates=activeRows.length?activeRows:group;
  const unique=new Map(candidates.map(x=>[JSON.stringify([x.nome,x.ativo,x.quark_unidade_id,x.quark_setor_id]),x]));
  if(unique.size===1)records.push([...unique.values()][0]);else conflicts++;
 }
 return {records,conflicts};
}
export async function collectPages(request:(query:string)=>Promise<unknown>,unit:string) {
 const initial=list(await request(''));const seen=new Map<string,Obj>();
 const key=(r:Obj)=>first(r.id,r.colaboradorId,r.colaborador_id);
 const add=(rows:Obj[])=>{let n=0;for(const r of rows){const id=key(r);if(!id)throw new Error(`QuarkRH: colaborador sem ID na unidade ${unit}.`);if(!seen.has(id)){seen.set(id,r);n++;}}return n;};
 add(initial);if(initial.length<100)return [...seen.values()];
 const formats=[['page','page_size',2,1],['page','page_size',1,1],['page','size',2,1],['page','size',1,1],['pagina','tamanho',2,1],['pagina','tamanho',1,1],['offset','limit',100,100]] as const;
 for(const [pk,sk,start,step] of formats) {
  const query=(page:number)=>new URLSearchParams({[pk]:String(page),[sk]:'100'}).toString();
  const second=list(await request(query(start)));
  if(!second.length)return [...seen.values()];
  if(!add(second))continue;
  if(second.length<100)return [...seen.values()];
  for(let i=1;i<100;i++) {
   const next=list(await request(query(start+i*step)));
   if(!next.length)return [...seen.values()];
   if(!add(next))throw new Error(`QuarkRH repetiu a página na unidade ${unit}; nenhum cadastro foi alterado.`);
   if(next.length<100)return [...seen.values()];
  }
  throw new Error(`Limite de páginas excedido na unidade ${unit}.`);
 }
 throw new Error(`Não foi possível confirmar a paginação da unidade ${unit}; nenhum cadastro foi alterado.`);
}
