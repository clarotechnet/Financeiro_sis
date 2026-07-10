-- Cria o perfil operacional "Assistente Financeiro".
-- Regra: pode visualizar dados e inserir novos lancamentos financeiros,
-- mas nao pode editar/excluir dados existentes nem gerenciar cadastros.


update public.profiles
set role = 'assistente_financeiro'
where role is null
   or role = 'user';

create or replace function public.is_approved_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
  );
$$;

revoke all on function public.is_approved_profile() from public;
grant execute on function public.is_approved_profile() to authenticated;

create or replace function public.is_assistente_financeiro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_profile_role(array['assistente_financeiro']);
$$;

revoke all on function public.is_assistente_financeiro() from public;
grant execute on function public.is_assistente_financeiro() to authenticated;

create or replace function public.bloquear_assistente_financeiro_update_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_assistente_financeiro() then
    raise exception 'Assistente Financeiro pode visualizar e lancar dados, mas nao pode editar ou excluir registros existentes.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.bloquear_assistente_financeiro_update_delete() from public;
grant execute on function public.bloquear_assistente_financeiro_update_delete() to authenticated;

create or replace function public.bloquear_assistente_financeiro_cadastros()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_assistente_financeiro() then
    raise exception 'Assistente Financeiro pode visualizar cadastros, mas nao pode criar, editar ou excluir cadastros administrativos.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.bloquear_assistente_financeiro_cadastros() from public;
grant execute on function public.bloquear_assistente_financeiro_cadastros() to authenticated;

create or replace function public.proteger_profiles_campos_sensiveis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not public.has_profile_role(array['admin']) then
      raise exception 'Somente administrador pode excluir contas do sistema.'
        using errcode = '42501';
    end if;

    return old;
  end if;

  if not public.has_profile_role(array['admin']) then
    if new.id is distinct from old.id then
      raise exception 'Nao e permitido alterar o identificador do perfil.'
        using errcode = '42501';
    end if;

    if new.email is distinct from old.email and old.email is not null then
      raise exception 'Nao e permitido alterar o email pelo perfil publico.'
        using errcode = '42501';
    end if;

    if new.role is distinct from old.role
       and not (
         old.role is null
         and new.role = 'assistente_financeiro'
         and new.id = auth.uid()
       ) then
      raise exception 'Somente administrador pode alterar o perfil de acesso.'
        using errcode = '42501';
    end if;

    if coalesce(new.approved, false) is distinct from coalesce(old.approved, false)
       or new.approved_at is distinct from old.approved_at then
      raise exception 'Somente administrador pode alterar aprovacao de usuarios.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.proteger_profiles_campos_sensiveis() from public;
grant execute on function public.proteger_profiles_campos_sensiveis() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "users can read own profile and approved users can read profiles" on public.profiles;
create policy "users can read own profile and approved users can read profiles"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_approved_profile()
);

drop policy if exists "users can insert own assistant profile" on public.profiles;
create policy "users can insert own assistant profile"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and coalesce(role, 'assistente_financeiro') = 'assistente_financeiro'
  and coalesce(approved, false) = false
);

drop policy if exists "users can update own public profile fields" on public.profiles;
create policy "users can update own public profile fields"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "admins can manage profiles" on public.profiles;
create policy "admins can manage profiles"
on public.profiles
for all
to authenticated
using (public.has_profile_role(array['admin']))
with check (public.has_profile_role(array['admin']));

drop trigger if exists trg_proteger_profiles_campos_sensiveis on public.profiles;
create trigger trg_proteger_profiles_campos_sensiveis
before update or delete on public.profiles
for each row
execute function public.proteger_profiles_campos_sensiveis();

grant select, insert, update, delete on public.profiles to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'lancamentos_pix',
    'receitas'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists trg_bloquear_assistente_financeiro_ud on public.%I', table_name);
      execute format(
        'create trigger trg_bloquear_assistente_financeiro_ud before update or delete on public.%I for each row execute function public.bloquear_assistente_financeiro_update_delete()',
        table_name
      );
    end if;
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'dados_financeiro',
    'registros_dados',
    'fornecedores',
    'plano_contas',
    'plano_contas_mapeamentos',
    'folha_verba_mapeamentos',
    'unidades',
    'setor',
    'bancos',
    'dre_linhas',
    'dre_linha_contas',
    'opcoes_categoria',
    'opcoes_centro_custeio',
    'opcoes_centro_de_custo',
    'opcoes_cnpj',
    'opcoes_secao_custeio',
    'opcoes_unidade'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists trg_bloquear_assistente_financeiro_cadastros on public.%I', table_name);
      execute format(
        'create trigger trg_bloquear_assistente_financeiro_cadastros before insert or update or delete on public.%I for each row execute function public.bloquear_assistente_financeiro_cadastros()',
        table_name
      );
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.lancamentos_pix') is not null then
    alter table public.lancamentos_pix enable row level security;

    drop policy if exists "approved users can read lancamentos_pix" on public.lancamentos_pix;
    create policy "approved users can read lancamentos_pix"
    on public.lancamentos_pix
    for select
    to authenticated
    using (public.is_approved_profile());

    drop policy if exists "approved users can insert lancamentos_pix" on public.lancamentos_pix;
    create policy "approved users can insert lancamentos_pix"
    on public.lancamentos_pix
    for insert
    to authenticated
    with check (public.is_approved_profile());

    drop policy if exists "admin and rh can update lancamentos_pix" on public.lancamentos_pix;
    create policy "admin and rh can update lancamentos_pix"
    on public.lancamentos_pix
    for update
    to authenticated
    using (public.has_profile_role(array['admin', 'rh']))
    with check (public.has_profile_role(array['admin', 'rh']));

    drop policy if exists "admin and rh can delete lancamentos_pix" on public.lancamentos_pix;
    create policy "admin and rh can delete lancamentos_pix"
    on public.lancamentos_pix
    for delete
    to authenticated
    using (public.has_profile_role(array['admin', 'rh']));

    grant select, insert, update, delete on public.lancamentos_pix to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.receitas') is not null then
    alter table public.receitas enable row level security;

    drop policy if exists "approved users can read receitas" on public.receitas;
    create policy "approved users can read receitas"
    on public.receitas
    for select
    to authenticated
    using (public.is_approved_profile());

    drop policy if exists "approved users can insert receitas" on public.receitas;
    create policy "approved users can insert receitas"
    on public.receitas
    for insert
    to authenticated
    with check (
      created_by = auth.uid()
      and public.is_approved_profile()
    );

    drop policy if exists "approved users can update own receitas" on public.receitas;
    drop policy if exists "admin and rh can update receitas" on public.receitas;
    create policy "admin and rh can update receitas"
    on public.receitas
    for update
    to authenticated
    using (public.has_profile_role(array['admin', 'rh']))
    with check (public.has_profile_role(array['admin', 'rh']));

    drop policy if exists "approved users can delete own receitas" on public.receitas;
    drop policy if exists "admin and rh can delete receitas" on public.receitas;
    create policy "admin and rh can delete receitas"
    on public.receitas
    for delete
    to authenticated
    using (public.has_profile_role(array['admin', 'rh']));

    drop policy if exists "admins can manage receitas" on public.receitas;

    grant select, insert, update, delete on public.receitas to authenticated;
  end if;
end $$;
