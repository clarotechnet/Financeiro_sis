-- Newly discovered companies require an explicit opt-in.
alter table public.quark_unidade_mapping add column sync_enabled boolean not null default false;
update public.quark_unidade_mapping set sync_enabled=true where quark_unidade_id in ('9417839','9417838','9417837','9417836','9417834','9338112');
create function public.discover_quark_department_units(p_units jsonb) returns void
 language sql security invoker set search_path='' as $$
 insert into public.quark_unidade_mapping(quark_unidade_id,quark_unidade_nome)
 select value->>'id',value->>'name' from jsonb_array_elements(p_units)
 on conflict (quark_unidade_id) do update set quark_unidade_nome=excluded.quark_unidade_nome
$$;
revoke all on function public.discover_quark_department_units(jsonb) from public,anon,authenticated;
grant execute on function public.discover_quark_department_units(jsonb) to service_role;
