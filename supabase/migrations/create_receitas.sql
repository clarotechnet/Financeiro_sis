-- Tabela de receitas/recebimentos para compor a parte positiva da DRE.
-- Receitas aceitam somente contas analiticas de natureza Receita ou Deducao.

do $$
begin
  if to_regclass('public.plano_contas') is null then
    raise exception 'A tabela public.plano_contas precisa existir antes desta migration.';
  end if;
end $$;

create table if not exists public.receitas (
  id uuid primary key default gen_random_uuid(),
  data_recebimento date not null,
  nome text not null,
  cliente text not null,
  descricao text null,
  valor numeric(14,2) not null,
  plano_conta_id uuid not null references public.plano_contas(id) on update cascade on delete restrict,
  banco text null,
  forma_recebimento text null,
  documento text null,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receitas_valor_check check (valor >= 0)
);

comment on table public.receitas is
  'Receitas e deducoes recebidas pela empresa para composicao da DRE.';
comment on column public.receitas.plano_conta_id is
  'Conta analitica do plano de contas. Deve ter natureza Receita ou Deducao.';
comment on column public.receitas.valor is
  'Valor positivo do recebimento/deducao. A natureza da conta define o sinal na DRE.';

create index if not exists idx_receitas_data_recebimento
  on public.receitas(data_recebimento desc);

create index if not exists idx_receitas_plano_conta_id
  on public.receitas(plano_conta_id);

create index if not exists idx_receitas_created_by
  on public.receitas(created_by);

drop trigger if exists trg_receitas_updated_at on public.receitas;
create trigger trg_receitas_updated_at
before update on public.receitas
for each row execute function public.set_updated_at();

create or replace function public.validar_receita_plano_conta(p_plano_conta_id uuid)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if p_plano_conta_id is null then
    raise exception 'A receita precisa estar vinculada a uma conta analitica de Receita ou Deducao.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.plano_contas pc
    where pc.id = p_plano_conta_id
      and pc.ativo = true
      and pc.e_analitica = true
      and pc.natureza in ('Receita', 'Dedução')
  ) then
    raise exception 'O plano_conta_id % deve apontar para uma conta analitica ativa de natureza Receita ou Deducao.', p_plano_conta_id
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.trg_validar_receita_plano_conta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.validar_receita_plano_conta(new.plano_conta_id);
  return new;
end;
$$;

drop trigger if exists trg_receitas_plano_conta on public.receitas;
create trigger trg_receitas_plano_conta
before insert or update of plano_conta_id on public.receitas
for each row execute function public.trg_validar_receita_plano_conta();

drop view if exists public.vw_receitas_plano_contas;

create view public.vw_receitas_plano_contas
with (security_invoker = on) as
select
  r.id,
  r.data_recebimento,
  r.nome,
  r.cliente,
  r.descricao,
  r.valor,
  r.plano_conta_id,
  r.banco,
  r.forma_recebimento,
  r.documento,
  r.created_by,
  r.created_at,
  r.updated_at,

  pc.conta_codigo,
  pc.conta_descricao,
  pc.conta_natureza,
  pc.subgrupo_id,
  pc.subgrupo_codigo,
  pc.subgrupo_descricao,
  pc.grupo_id,
  pc.grupo_codigo,
  pc.grupo_descricao,
  pc.caminho_codigo,
  pc.caminho_descricao,
  pc.conta_codigo || ' - ' || pc.conta_descricao as conta_analitica,
  pc.grupo_codigo || ' - ' || pc.grupo_descricao as grupo_conta,
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta
from public.receitas r
join public.vw_plano_contas_relatorio pc
  on pc.conta_id = r.plano_conta_id;

alter table public.receitas enable row level security;

drop policy if exists "approved users can read receitas" on public.receitas;
create policy "approved users can read receitas"
on public.receitas
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

drop policy if exists "approved users can insert receitas" on public.receitas;
create policy "approved users can insert receitas"
on public.receitas
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
  )
);

drop policy if exists "approved users can update own receitas" on public.receitas;
create policy "approved users can update own receitas"
on public.receitas
for update
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
  )
);

drop policy if exists "approved users can delete own receitas" on public.receitas;
create policy "approved users can delete own receitas"
on public.receitas
for delete
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
  )
);

drop policy if exists "admins can manage receitas" on public.receitas;
create policy "admins can manage receitas"
on public.receitas
for all
to authenticated
using (public.has_profile_role(array['admin']))
with check (public.has_profile_role(array['admin']));

grant execute on function public.validar_receita_plano_conta(uuid) to authenticated;
grant select, insert, update, delete on public.receitas to authenticated;
grant select on public.vw_receitas_plano_contas to authenticated;
