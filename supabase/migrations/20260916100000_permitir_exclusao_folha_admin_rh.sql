-- Alinha a Folha de Pagamento com as permissoes usadas em Beneficios:
-- perfis aprovados podem consultar; somente Administrador e RH podem alterar dados existentes.

alter table public.dados_financeiro enable row level security;

drop policy if exists "Admins manage dados_financeiro" on public.dados_financeiro;
drop policy if exists "admin_select_dados_financeiro" on public.dados_financeiro;
drop policy if exists "approved users can read dados_financeiro" on public.dados_financeiro;
drop policy if exists "admin and rh can insert dados_financeiro" on public.dados_financeiro;
drop policy if exists "admin and rh can update dados_financeiro" on public.dados_financeiro;
drop policy if exists "admin and rh can delete dados_financeiro" on public.dados_financeiro;

create policy "approved users can read dados_financeiro"
on public.dados_financeiro
for select
to authenticated
using (public.is_approved_profile());

create policy "admin and rh can insert dados_financeiro"
on public.dados_financeiro
for insert
to authenticated
with check (public.has_profile_role(array['admin', 'rh']));

create policy "admin and rh can update dados_financeiro"
on public.dados_financeiro
for update
to authenticated
using (public.has_profile_role(array['admin', 'rh']))
with check (public.has_profile_role(array['admin', 'rh']));

create policy "admin and rh can delete dados_financeiro"
on public.dados_financeiro
for delete
to authenticated
using (public.has_profile_role(array['admin', 'rh']));

grant select, insert, update, delete on public.dados_financeiro to authenticated;
