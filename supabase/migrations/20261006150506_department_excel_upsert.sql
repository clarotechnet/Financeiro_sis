-- Atomic Excel import. Updates by CPF without touching financial or Quark links.
create function public.import_department_excel(p_records jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r jsonb; exists_before boolean; ncreated integer:=0; nupdated integer:=0; setor_nome text;
begin
 if not public.has_profile_role(array['admin','rh']) then raise exception 'Acesso restrito a Admin e RH aprovados.' using errcode='42501'; end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records)=0 then raise exception 'A planilha não possui registros válidos.'; end if;
 perform pg_advisory_xact_lock(610062026);
 if exists(select 1 from jsonb_array_elements(p_records) v where coalesce(v->>'nome','')='' or coalesce(v->>'cpf','') !~ '^[0-9]{11}$') then raise exception 'Existem linhas com nome vazio ou CPF inválido.'; end if;
 if exists(select 1 from jsonb_array_elements(p_records) v group by v->>'cpf' having count(*)>1) then raise exception 'Existem CPFs repetidos na planilha com mais de uma linha.'; end if;
 if exists(select 1 from jsonb_array_elements(p_records) v where not exists(select 1 from public.setor s where s.codigo=v->>'setor_codigo' and s.ativo)) then raise exception 'Existem setores não encontrados ou inativos na planilha.'; end if;
 if exists(select 1 from jsonb_array_elements(p_records) v where not exists(select 1 from public.unidades u where u.codigo=v->>'unidade_codigo' and u.ativo)) then raise exception 'Existem unidades não encontradas ou inativas na planilha.'; end if;
 if exists(select 1 from jsonb_array_elements(p_records) v where v ? 'ativo' and jsonb_typeof(v->'ativo') not in ('boolean','null')) then raise exception 'A situação deve ser Ativo ou Inativo.'; end if;
 for r in select value from jsonb_array_elements(p_records) loop
  select s.setor into setor_nome from public.setor s where s.codigo=r->>'setor_codigo';
  select exists(select 1 from public.registros_dados where cpf=r->>'cpf') into exists_before;
  insert into public.registros_dados as target(nome,cpf,setor,setor_codigo,unidade_codigo,ativo,origem,ultima_origem_atualizacao,updated_at)
  values(trim(r->>'nome'),r->>'cpf',setor_nome,r->>'setor_codigo',r->>'unidade_codigo',(r->>'ativo')::boolean,'Excel','Excel',now())
  on conflict(cpf) do update set nome=excluded.nome,setor=excluded.setor,setor_codigo=excluded.setor_codigo,unidade_codigo=excluded.unidade_codigo,
   ativo=case when r ? 'ativo' then excluded.ativo else target.ativo end,
   origem=coalesce(target.origem,'Excel'),ultima_origem_atualizacao='Excel',updated_at=now();
  if exists_before then nupdated:=nupdated+1; else ncreated:=ncreated+1; end if;
 end loop;
 return jsonb_build_object('created',ncreated,'updated',nupdated,'total',ncreated+nupdated);
end $$;
revoke all on function public.import_department_excel(jsonb) from public,anon;
grant execute on function public.import_department_excel(jsonb) to authenticated;
