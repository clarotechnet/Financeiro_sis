-- Additive migration: existing records, CPF keys and financial links are preserved.
alter table public.registros_dados
 add column ativo boolean,
 add column origem text check (origem in ('QuarkRH','Excel','Manual')),
 add column ultima_origem_atualizacao text check (ultima_origem_atualizacao in ('QuarkRH','Excel','Manual')),
 add column quark_colaborador_id text,
 add column quark_setor_id text,
 add column quark_setor_nome text,
 add column quark_unidade_id text,
 add column quark_unidade_nome text,
 add column quark_setor_pendente boolean not null default false,
 add column quark_unidade_pendente boolean not null default false,
 add column quark_synced_at timestamptz;

create table public.quark_unidade_mapping (
 quark_unidade_id text primary key, quark_unidade_nome text not null,
 unidade_codigo text references public.unidades(codigo) on update cascade on delete restrict,
 updated_at timestamptz not null default now()
);
create table public.quark_setor_mapping (
 quark_unidade_id text not null references public.quark_unidade_mapping(quark_unidade_id),
 quark_setor_id text not null, quark_setor_nome text not null,
 setor_codigo text references public.setor(codigo) on update cascade on delete restrict,
 updated_at timestamptz not null default now(),
 primary key (quark_unidade_id,quark_setor_id)
);
create table public.quark_department_sync_runs (
 id uuid primary key default gen_random_uuid(), triggered_by uuid not null references public.profiles(id),
 status text not null check (status in ('RUNNING','SUCCESS','ERROR')),
 received integer not null default 0, created integer not null default 0,
 updated integer not null default 0, skipped integer not null default 0,
 unmapped integer not null default 0, conflicts integer not null default 0,
 started_at timestamptz not null default now(), completed_at timestamptz, error_message text
);
alter table public.quark_unidade_mapping enable row level security;
alter table public.quark_setor_mapping enable row level security;
alter table public.quark_department_sync_runs enable row level security;
grant select,insert,update on public.quark_unidade_mapping,public.quark_setor_mapping to authenticated;
grant select on public.quark_department_sync_runs to authenticated;
grant all on public.quark_unidade_mapping,public.quark_setor_mapping,public.quark_department_sync_runs to service_role;
create policy quark_units_read on public.quark_unidade_mapping for select to authenticated using (public.has_profile_role(array['admin','rh','assistente_financeiro']));
create policy quark_units_insert on public.quark_unidade_mapping for insert to authenticated with check (public.has_profile_role(array['admin','rh']));
create policy quark_units_update on public.quark_unidade_mapping for update to authenticated using (public.has_profile_role(array['admin','rh'])) with check (public.has_profile_role(array['admin','rh']));
create policy quark_teams_read on public.quark_setor_mapping for select to authenticated using (public.has_profile_role(array['admin','rh','assistente_financeiro']));
create policy quark_teams_insert on public.quark_setor_mapping for insert to authenticated with check (public.has_profile_role(array['admin','rh']));
create policy quark_teams_update on public.quark_setor_mapping for update to authenticated using (public.has_profile_role(array['admin','rh'])) with check (public.has_profile_role(array['admin','rh']));
create policy quark_runs_read on public.quark_department_sync_runs for select to authenticated using (public.has_profile_role(array['admin','rh','assistente_financeiro']));
create unique index quark_department_one_run on public.quark_department_sync_runs ((true)) where status='RUNNING';
create index quark_department_runs_date on public.quark_department_sync_runs (started_at desc);
create index registros_quark_team on public.registros_dados(quark_unidade_id,quark_setor_id);
insert into public.quark_unidade_mapping values
 ('9417839','VNA TELECOM LTDA - NATAL','2',now()),
 ('9338112','DMV DINIZ-NATAL','2',now()),
 ('9417838','VNA TELECOM LTDA - Mossoró','3',now()),
 ('9417836','RDT TELECOM LTDA - FORTALEZA','4',now()),
 ('9417837','RDT TELECOM LTDA - RECIFE','5',now()),
 ('9417834','DMV DINIZ - RECIFE','5',now());

-- Restricted credential bridge: the decrypted value is available only to the server role.
create schema if not exists financeiro_private;
revoke all on schema financeiro_private from public,anon,authenticated;
grant usage on schema financeiro_private to service_role;
create function financeiro_private.quark_department_token() returns text
 language sql security definer set search_path='' as $$
 select decrypted_secret from vault.decrypted_secrets where name='QUARK_DEPARTMENT_AUTH_TOKEN'
$$;
revoke all on function financeiro_private.quark_department_token() from public,anon,authenticated;
grant execute on function financeiro_private.quark_department_token() to service_role;
create function public.quark_department_token() returns text
 language sql security invoker set search_path='' as $$ select financeiro_private.quark_department_token() $$;
revoke all on function public.quark_department_token() from public,anon,authenticated;
grant execute on function public.quark_department_token() to service_role;

create function public.save_quark_department_mapping(p_kind text,p_unit text,p_team text,p_code text)
 returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if not public.has_profile_role(array['admin','rh']) then raise exception 'Acesso negado' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(610062026);
 if p_code is null or p_code='' then raise exception 'Selecione um código'; end if;
 if p_kind='unidade' then
  if not exists(select 1 from public.unidades where codigo=p_code and ativo) then raise exception 'Unidade inválida'; end if;
  update public.quark_unidade_mapping set unidade_codigo=p_code,updated_at=now() where quark_unidade_id=p_unit;
  if not found then raise exception 'Unidade Quark não encontrada'; end if;
  update public.registros_dados set unidade_codigo=p_code,quark_unidade_pendente=false,ultima_origem_atualizacao='Manual',updated_at=now() where quark_unidade_id=p_unit;
 elsif p_kind='setor' then
  if not exists(select 1 from public.setor where codigo=p_code and ativo) then raise exception 'Setor inválido'; end if;
  update public.quark_setor_mapping set setor_codigo=p_code,updated_at=now() where quark_unidade_id=p_unit and quark_setor_id=p_team;
  if not found then raise exception 'Equipe Quark não encontrada'; end if;
  update public.registros_dados set setor_codigo=p_code,setor=(select setor from public.setor where codigo=p_code),quark_setor_pendente=false,ultima_origem_atualizacao='Manual',updated_at=now() where quark_unidade_id=p_unit and quark_setor_id=p_team;
 else raise exception 'Tipo de mapeamento inválido'; end if;
 get diagnostics affected=row_count;
 return affected;
end $$;
revoke all on function public.save_quark_department_mapping(text,text,text,text) from public,anon;
grant execute on function public.save_quark_department_mapping(text,text,text,text) to authenticated;

-- Called only by Edge Function after authentication. Everything commits atomically.
create function public.sync_quark_department(p_actor uuid,p_run uuid,p_records jsonb,p_received integer,p_skipped integer,p_conflicts integer)
 returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb; oldrow public.registros_dados%rowtype; sc text; uc text; sn text;
 ncreated integer:=0; nupdated integer:=0; nunmapped integer:=0; nskip integer:=p_skipped;
begin
 if not exists(select 1 from public.profiles where id=p_actor and approved and role in ('admin','rh')) then raise exception 'Acesso negado' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(610062026);
 if not exists(select 1 from public.quark_department_sync_runs where id=p_run and triggered_by=p_actor and status='RUNNING') then raise exception 'Sincronização inválida'; end if;
 for r in select value from jsonb_array_elements(p_records) loop
  if r->>'cpf' !~ '^\d{11}$' or coalesce(r->>'nome','')='' then nskip:=nskip+1; continue; end if;
  insert into public.quark_unidade_mapping(quark_unidade_id,quark_unidade_nome) values(r->>'quark_unidade_id',r->>'quark_unidade_nome')
  on conflict(quark_unidade_id) do update set quark_unidade_nome=excluded.quark_unidade_nome;
  insert into public.quark_setor_mapping(quark_unidade_id,quark_setor_id,quark_setor_nome) values(r->>'quark_unidade_id',r->>'quark_setor_id',r->>'quark_setor_nome')
  on conflict(quark_unidade_id,quark_setor_id) do update set quark_setor_nome=excluded.quark_setor_nome;
  select m.setor_codigo,s.setor into sc,sn from public.quark_setor_mapping m join public.setor s on s.codigo=m.setor_codigo and s.ativo where m.quark_unidade_id=r->>'quark_unidade_id' and m.quark_setor_id=r->>'quark_setor_id';
  select m.unidade_codigo into uc from public.quark_unidade_mapping m join public.unidades u on u.codigo=m.unidade_codigo and u.ativo where m.quark_unidade_id=r->>'quark_unidade_id';
  select * into oldrow from public.registros_dados where cpf=r->>'cpf' for update;
  if sc is null or uc is null then nunmapped:=nunmapped+1; end if;
  if found then
   update public.registros_dados set nome=r->>'nome',ativo=coalesce((r->>'ativo')::boolean,oldrow.ativo),
    setor_codigo=coalesce(sc,oldrow.setor_codigo),setor=coalesce(sn,oldrow.setor),unidade_codigo=coalesce(uc,oldrow.unidade_codigo),
    origem=coalesce(oldrow.origem,'QuarkRH'),ultima_origem_atualizacao='QuarkRH',updated_at=now(),
    quark_colaborador_id=r->>'quark_colaborador_id',quark_setor_id=r->>'quark_setor_id',quark_setor_nome=r->>'quark_setor_nome',
    quark_unidade_id=r->>'quark_unidade_id',quark_unidade_nome=r->>'quark_unidade_nome',
    quark_setor_pendente=sc is null,quark_unidade_pendente=uc is null,quark_synced_at=now() where id=oldrow.id;
   nupdated:=nupdated+1;
  else
   insert into public.registros_dados(nome,cpf,setor,setor_codigo,unidade_codigo,ativo,origem,ultima_origem_atualizacao,quark_colaborador_id,quark_setor_id,quark_setor_nome,quark_unidade_id,quark_unidade_nome,quark_setor_pendente,quark_unidade_pendente,quark_synced_at)
   values(r->>'nome',r->>'cpf',sn,sc,uc,(r->>'ativo')::boolean,'QuarkRH','QuarkRH',r->>'quark_colaborador_id',r->>'quark_setor_id',r->>'quark_setor_nome',r->>'quark_unidade_id',r->>'quark_unidade_nome',sc is null,uc is null,now());
   ncreated:=ncreated+1;
  end if;
 end loop;
 update public.quark_department_sync_runs set status='SUCCESS',received=p_received,created=ncreated,updated=nupdated,skipped=nskip,unmapped=nunmapped,conflicts=p_conflicts,completed_at=now() where id=p_run;
 return jsonb_build_object('received',p_received,'created',ncreated,'updated',nupdated,'skipped',nskip,'unmapped',nunmapped,'conflicts',p_conflicts);
end $$;
revoke all on function public.sync_quark_department(uuid,uuid,jsonb,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.sync_quark_department(uuid,uuid,jsonb,integer,integer,integer) to service_role;
