create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.has_profile_role(allowed_roles text[])
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
      and p.role = any (allowed_roles)
  );
$$;

revoke all on function public.has_profile_role(text[]) from public;
grant execute on function public.has_profile_role(text[]) to authenticated;

create table if not exists public.plano_contas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text not null,
  natureza text null,
  parent_id uuid null references public.plano_contas(id) on update cascade on delete restrict,
  ativo boolean not null default true,
  ordem integer not null default 0,
  nivel smallint generated always as (
    case
      when split_part(codigo, '-', 2) = '00' and split_part(codigo, '-', 3) = '000' then 1
      when split_part(codigo, '-', 3) = '000' then 2
      else 3
    end
  ) stored,
  grupo_codigo smallint generated always as (split_part(codigo, '-', 1)::smallint) stored,
  subgrupo_codigo smallint generated always as (split_part(codigo, '-', 2)::smallint) stored,
  conta_codigo smallint generated always as (split_part(codigo, '-', 3)::smallint) stored,
  e_analitica boolean generated always as (split_part(codigo, '-', 3) <> '000') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plano_contas_codigo_formato_check
    check (codigo ~ '^[0-9]{2}-[0-9]{2}-[0-9]{3}$'),
  constraint plano_contas_natureza_check
    check (natureza is null or natureza in ('Receita', 'Dedução', 'Custo', 'Despesa', 'Ativo')),
  constraint plano_contas_parent_nivel_check
    check (
      (nivel = 1 and parent_id is null)
      or (nivel in (2, 3) and parent_id is not null)
    )
);

comment on table public.plano_contas is
  'Plano de contas hierarquico. Regra: XX-00-000 = grupo, XX-YY-000 = subgrupo, XX-YY-ZZZ = conta analitica.';
comment on column public.plano_contas.codigo is 'Codigo no formato XX-YY-ZZZ.';
comment on column public.plano_contas.parent_id is 'Pai hierarquico: subgrupo aponta para grupo; conta analitica aponta para subgrupo.';
comment on column public.plano_contas.e_analitica is 'True quando a conta pode receber lancamentos diretamente.';

create index if not exists idx_plano_contas_parent_id on public.plano_contas(parent_id);
create index if not exists idx_plano_contas_nivel on public.plano_contas(nivel);
create index if not exists idx_plano_contas_natureza on public.plano_contas(natureza);
create index if not exists idx_plano_contas_ativo on public.plano_contas(ativo) where ativo = true;

create or replace function public.plano_contas_set_parent_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parte_grupo text;
  v_parte_subgrupo text;
  v_parte_conta text;
  v_parent_codigo text;
begin
  v_parte_grupo := split_part(new.codigo, '-', 1);
  v_parte_subgrupo := split_part(new.codigo, '-', 2);
  v_parte_conta := split_part(new.codigo, '-', 3);

  if v_parte_subgrupo = '00' and v_parte_conta = '000' then
    new.parent_id := null;
    return new;
  end if;

  if v_parte_conta = '000' then
    v_parent_codigo := v_parte_grupo || '-00-000';
  else
    v_parent_codigo := v_parte_grupo || '-' || v_parte_subgrupo || '-000';
  end if;

  select pc.id
    into new.parent_id
  from public.plano_contas pc
  where pc.codigo = v_parent_codigo;

  if new.parent_id is null then
    raise exception 'Conta pai % nao encontrada para %', v_parent_codigo, new.codigo
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_plano_contas_set_parent_id on public.plano_contas;
create trigger trg_plano_contas_set_parent_id
before insert or update of codigo on public.plano_contas
for each row execute function public.plano_contas_set_parent_id();

drop trigger if exists trg_plano_contas_updated_at on public.plano_contas;
create trigger trg_plano_contas_updated_at
before update on public.plano_contas
for each row execute function public.set_updated_at();

create table if not exists public.plano_contas_mapeamentos (
  id uuid primary key default gen_random_uuid(),
  plano_conta_id uuid not null references public.plano_contas(id) on update cascade on delete restrict,
  origem text not null,
  campo_origem text not null,
  valor_origem text not null,
  prioridade smallint not null default 100,
  ativo boolean not null default true,
  observacao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plano_contas_mapeamentos_origem_check
    check (origem in ('lancamentos_pix', 'dados_financeiro', 'manual', 'importacao_excel'))
);

comment on table public.plano_contas_mapeamentos is
  'Regras para ligar textos/campos dos dados financeiros a uma conta do plano de contas.';
comment on column public.plano_contas_mapeamentos.origem is
  'Fonte do dado: lancamentos_pix, dados_financeiro, manual ou importacao_excel.';
comment on column public.plano_contas_mapeamentos.campo_origem is
  'Campo usado para classificar, por exemplo categoria, centro_de_custo, descricao, setor ou verba.';
comment on column public.plano_contas_mapeamentos.valor_origem is
  'Valor textual do campo de origem que deve apontar para a conta.';

create index if not exists idx_plano_contas_mapeamentos_conta
  on public.plano_contas_mapeamentos(plano_conta_id);

create index if not exists idx_plano_contas_mapeamentos_lookup
  on public.plano_contas_mapeamentos(origem, campo_origem, lower(btrim(valor_origem)))
  where ativo = true;

create unique index if not exists uq_plano_contas_mapeamentos_ativo
  on public.plano_contas_mapeamentos(origem, campo_origem, lower(btrim(valor_origem)))
  where ativo = true;

drop trigger if exists trg_plano_contas_mapeamentos_updated_at on public.plano_contas_mapeamentos;
create trigger trg_plano_contas_mapeamentos_updated_at
before update on public.plano_contas_mapeamentos
for each row execute function public.set_updated_at();

do $$
begin
  if to_regclass('public.lancamentos_pix') is not null then
    alter table public.lancamentos_pix
      add column if not exists plano_conta_id uuid null
      references public.plano_contas(id) on update cascade on delete set null;

    create index if not exists idx_lancamentos_pix_plano_conta_id
      on public.lancamentos_pix(plano_conta_id);
  end if;

  if to_regclass('public.dados_financeiro') is not null then
    alter table public.dados_financeiro
      add column if not exists plano_conta_id uuid null
      references public.plano_contas(id) on update cascade on delete set null;

    create index if not exists idx_dados_financeiro_plano_conta_id
      on public.dados_financeiro(plano_conta_id);
  end if;
end $$;

create or replace view public.vw_plano_contas_hierarquia as
select
  c.id,
  c.codigo,
  c.descricao,
  c.natureza,
  c.nivel,
  c.e_analitica,
  c.ativo,
  c.ordem,
  c.parent_id,
  p.codigo as codigo_pai,
  p.descricao as descricao_pai,
  gp.codigo as codigo_grupo,
  gp.descricao as descricao_grupo,
  case
    when c.nivel = 1 then c.codigo
    when c.nivel = 2 then p.codigo || ' > ' || c.codigo
    else gp.codigo || ' > ' || p.codigo || ' > ' || c.codigo
  end as caminho_codigo,
  case
    when c.nivel = 1 then c.descricao
    when c.nivel = 2 then p.descricao || ' > ' || c.descricao
    else gp.descricao || ' > ' || p.descricao || ' > ' || c.descricao
  end as caminho_descricao,
  c.created_at,
  c.updated_at
from public.plano_contas c
left join public.plano_contas p on p.id = c.parent_id
left join public.plano_contas gp on gp.id = p.parent_id;

alter table public.plano_contas enable row level security;
alter table public.plano_contas_mapeamentos enable row level security;

create policy "approved users can read plano_contas"
on public.plano_contas
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

create policy "admins can manage plano_contas"
on public.plano_contas
for all
to authenticated
using (public.has_profile_role(array['admin']))
with check (public.has_profile_role(array['admin']));

create policy "approved users can read plano_contas_mapeamentos"
on public.plano_contas_mapeamentos
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

create policy "admins can manage plano_contas_mapeamentos"
on public.plano_contas_mapeamentos
for all
to authenticated
using (public.has_profile_role(array['admin']))
with check (public.has_profile_role(array['admin']));


