-- Permite que admin/RH mantenham o cadastro do Departamento Pessoal.
-- Sem estes grants o PostgREST retorna 403 antes mesmo de avaliar as policies.

do $$
begin
  if to_regclass('public.registros_dados') is null then
    raise exception 'A tabela public.registros_dados precisa existir antes desta migration.';
  end if;
end $$;

alter table public.registros_dados enable row level security;

drop policy if exists "approved users can read registros_dados" on public.registros_dados;
create policy "approved users can read registros_dados"
on public.registros_dados
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
  )
);

drop policy if exists "admin and rh can insert registros_dados" on public.registros_dados;
create policy "admin and rh can insert registros_dados"
on public.registros_dados
for insert
to authenticated
with check (public.has_profile_role(array['admin', 'rh']));

drop policy if exists "admin and rh can update registros_dados" on public.registros_dados;
create policy "admin and rh can update registros_dados"
on public.registros_dados
for update
to authenticated
using (public.has_profile_role(array['admin', 'rh']))
with check (public.has_profile_role(array['admin', 'rh']));

grant select, insert, update on public.registros_dados to authenticated;
