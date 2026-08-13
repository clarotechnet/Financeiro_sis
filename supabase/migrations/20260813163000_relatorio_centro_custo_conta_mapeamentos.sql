-- Classificacao automatica exclusiva do relatorio da Folha importado em Pagamentos.


do $$
begin
  if to_regclass('public.setor') is null
     or to_regclass('public.plano_contas') is null then
    raise exception 'As tabelas public.setor e public.plano_contas precisam existir antes desta migration.';
  end if;
end $$;

create table if not exists public.folha_centro_custo_conta_mapeamentos (
  id uuid primary key default gen_random_uuid(),
  setor_codigo text not null references public.setor(codigo) on update cascade on delete restrict,
  plano_conta_id uuid not null references public.plano_contas(id) on update cascade on delete restrict,
  ativo boolean not null default true,
  observacao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folha_cc_conta_unique unique (setor_codigo)
);

comment on table public.folha_centro_custo_conta_mapeamentos is
  'Define a conta analitica de cada centro de custo exclusivamente ao importar o relatorio da Folha em Pagamentos.';
comment on column public.folha_centro_custo_conta_mapeamentos.setor_codigo is
  'Centro de custo presente na coluna CENTRO DE CUSTO CODIGO do relatorio.';
comment on column public.folha_centro_custo_conta_mapeamentos.plano_conta_id is
  'Conta analitica aplicada automaticamente ao importar o relatorio.';

create index if not exists idx_folha_cc_conta_lookup
  on public.folha_centro_custo_conta_mapeamentos(setor_codigo)
  where ativo = true;

create index if not exists idx_folha_cc_conta_plano
  on public.folha_centro_custo_conta_mapeamentos(plano_conta_id);

create or replace function public.validar_folha_centro_custo_conta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.plano_contas pc
    where pc.id = new.plano_conta_id
      and pc.e_analitica = true
      and pc.ativo = true
      and pc.natureza in ('Custo', 'Despesa')
  ) then
    raise exception 'A conta do mapeamento deve ser analitica, ativa e de natureza Custo ou Despesa.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_folha_cc_conta
  on public.folha_centro_custo_conta_mapeamentos;
create trigger trg_validar_folha_cc_conta
before insert or update of plano_conta_id
on public.folha_centro_custo_conta_mapeamentos
for each row execute function public.validar_folha_centro_custo_conta();

drop trigger if exists trg_folha_cc_conta_updated_at
  on public.folha_centro_custo_conta_mapeamentos;
create trigger trg_folha_cc_conta_updated_at
before update on public.folha_centro_custo_conta_mapeamentos
for each row execute function public.set_updated_at();

-- Classificacao da Folha definida pelo financeiro. Nenhuma regra abaixo e
-- inferida de registros_dados ou do antigo subgrupo_plano_conta_id.
do $$
begin
  insert into public.folha_centro_custo_conta_mapeamentos (
    setor_codigo,
    plano_conta_id,
    observacao
  )
  select
    regra.setor_codigo,
    pc.id,
    'Classificacao da Folha definida pelo financeiro.'
  from (
    values
      ('S001', '02-02-001'),
      ('S002', '02-02-001'),
      ('S003', '02-02-001'),
      ('S004', '02-02-001'),
      ('S005', '02-02-001'),
      ('S006', '02-02-001'),
      ('S007', '02-02-001'),
      ('S008', '02-02-001'),
      ('S009', '02-02-001'),
      ('S010', '02-02-001'),
      ('S011', '02-02-001'),
      ('S012', '02-02-001'),
      ('S013', '02-02-001'),
      ('S014', '02-02-001'),
      ('S015', '02-02-001'),
      ('S016', '02-02-001'),
      ('S017', '02-02-001'),
      ('S018', '03-01-001'),
      ('S019', '03-01-001'),
      ('S020', '03-01-001'),
      ('S021', '03-01-001'),
      ('S022', '03-05-001'),
      ('S023', '03-01-001'),
      ('S024', '03-01-001'),
      ('S025', '02-02-001'),
      ('S026', '02-02-001'),
      ('S027', '03-01-001'),
      ('S028', '02-02-001'),
      ('S029', '02-02-001'),
      ('S030', '02-02-001'),
      ('S031', '03-01-001')
  ) as regra(setor_codigo, conta_codigo)
  join public.setor s
    on s.codigo = regra.setor_codigo
  join public.plano_contas pc
    on pc.codigo = regra.conta_codigo
   and pc.e_analitica = true
   and pc.ativo = true
  on conflict (setor_codigo) do update
  set
    plano_conta_id = excluded.plano_conta_id,
    ativo = true,
    observacao = excluded.observacao,
    updated_at = now();

  if (
    select count(*)
    from public.folha_centro_custo_conta_mapeamentos m
    where m.ativo = true
      and m.setor_codigo = any (array[
        'S001', 'S002', 'S003', 'S004', 'S005', 'S006', 'S007', 'S008',
        'S009', 'S010', 'S011', 'S012', 'S013', 'S014', 'S015', 'S016',
        'S017', 'S018', 'S019', 'S020', 'S021', 'S022', 'S023', 'S024',
        'S025', 'S026', 'S027', 'S028', 'S029', 'S030', 'S031'
      ])
  ) <> 31 then
    raise exception 'Nao foi possivel cadastrar os 31 mapeamentos da Folha. Verifique os setores e as contas 02-02-001, 03-01-001 e 03-05-001.';
  end if;
end $$;

create or replace view public.vw_folha_centro_custo_conta_mapeamentos
with (security_invoker = on) as
select
  m.id,
  m.setor_codigo,
  s.setor as centro_custo,
  m.plano_conta_id,
  pc.codigo as conta_codigo,
  pc.descricao as conta_descricao,
  pc.natureza as conta_natureza,
  m.ativo,
  m.observacao,
  m.created_at,
  m.updated_at
from public.folha_centro_custo_conta_mapeamentos m
join public.setor s on s.codigo = m.setor_codigo
join public.plano_contas pc on pc.id = m.plano_conta_id;

alter table public.folha_centro_custo_conta_mapeamentos enable row level security;

drop policy if exists "approved users can read payroll cost center mappings"
  on public.folha_centro_custo_conta_mapeamentos;
create policy "approved users can read payroll cost center mappings"
on public.folha_centro_custo_conta_mapeamentos
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

drop policy if exists "admins can manage payroll cost center mappings"
  on public.folha_centro_custo_conta_mapeamentos;
create policy "admins can manage payroll cost center mappings"
on public.folha_centro_custo_conta_mapeamentos
for all
to authenticated
using (public.has_profile_role(array['admin']))
with check (public.has_profile_role(array['admin']));

grant select, insert, update, delete
  on public.folha_centro_custo_conta_mapeamentos to authenticated;
grant select on public.vw_folha_centro_custo_conta_mapeamentos to authenticated;
