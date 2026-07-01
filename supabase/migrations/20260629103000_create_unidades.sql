-- Cadastro mestre de unidades.
-- O codigo e a chave de negocio usada para associar funcionarios em registros_dados.

do $$
begin
  if to_regclass('public.registros_dados') is null then
    raise exception 'A tabela public.registros_dados precisa existir antes desta migration.';
  end if;
end $$;

create table if not exists public.unidades (
  codigo text primary key,
  unidade text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unidades_codigo_not_blank check (btrim(codigo) <> ''),
  constraint unidades_unidade_not_blank check (btrim(unidade) <> '')
);

comment on table public.unidades is
  'Cadastro mestre de unidades da empresa. O codigo funciona como chave de negocio da unidade.';
comment on column public.unidades.codigo is
  'Codigo da unidade vindo do cadastro oficial/Excel. Usado para associar funcionarios.';
comment on column public.unidades.unidade is
  'Nome da unidade.';

create unique index if not exists idx_unidades_unidade_ativa_unique
  on public.unidades (upper(btrim(unidade)))
  where ativo = true;

drop trigger if exists trg_unidades_updated_at on public.unidades;
create trigger trg_unidades_updated_at
before update on public.unidades
for each row execute function public.set_updated_at();

insert into public.unidades (codigo, unidade)
values
  ('1', 'MATRIZ - SEDE ADMINISTRATIVA'),
  ('2', 'FILIAL 01 - NATAL'),
  ('3', 'FILIAL 02 - MOSSORÓ'),
  ('4', 'FILIAL 03 - FORTALEZA'),
  ('5', 'FILIAL 04 - RECIFE'),
  ('6', 'CACAU SHOW'),
  ('7', 'DS HOLDING'),
  ('8', 'SACOLÃO'),
  ('9', 'DIOGO'),
  ('10', 'RAFAEL')
on conflict (codigo) do update
set
  unidade = excluded.unidade,
  ativo = true,
  updated_at = now();

alter table public.registros_dados
  add column if not exists unidade_codigo text null;

comment on column public.registros_dados.unidade_codigo is
  'Codigo da unidade associada ao funcionario/CPF. Referencia public.unidades(codigo).';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registros_dados_unidade_codigo_fkey'
      and conrelid = 'public.registros_dados'::regclass
  ) then
    alter table public.registros_dados
      add constraint registros_dados_unidade_codigo_fkey
      foreign key (unidade_codigo)
      references public.unidades(codigo)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists idx_registros_dados_unidade_codigo
  on public.registros_dados(unidade_codigo);

drop view if exists public.vw_registros_dados_classificacao;

create view public.vw_registros_dados_classificacao
with (security_invoker = on) as
select
  rd.id,
  rd.nome,
  rd.cpf,
  rd.setor,
  rd.unidade_codigo,
  u.unidade as unidade_nome,
  rd.subgrupo_plano_conta_id,

  s.codigo as subgrupo_codigo,
  s.descricao as subgrupo_descricao,
  s.natureza as subgrupo_natureza,

  g.id as grupo_id,
  g.codigo as grupo_codigo,
  g.descricao as grupo_descricao,
  g.natureza as grupo_natureza,

  rd.created_at,
  rd.updated_at
from public.registros_dados rd
left join public.unidades u on u.codigo = rd.unidade_codigo
left join public.plano_contas s on s.id = rd.subgrupo_plano_conta_id
left join public.plano_contas g on g.id = s.parent_id;

drop view if exists public.vw_registros_dados_unidades;

create view public.vw_registros_dados_unidades
with (security_invoker = on) as
select
  rd.id,
  rd.nome,
  rd.cpf,
  rd.setor,
  rd.unidade_codigo,
  u.unidade as unidade_nome,
  u.ativo as unidade_ativa,
  rd.created_at,
  rd.updated_at
from public.registros_dados rd
left join public.unidades u on u.codigo = rd.unidade_codigo;

alter table public.unidades enable row level security;

drop policy if exists "approved users can read unidades" on public.unidades;
create policy "approved users can read unidades"
on public.unidades
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

drop policy if exists "admin and rh can manage unidades" on public.unidades;
create policy "admin and rh can manage unidades"
on public.unidades
for all
to authenticated
using (public.has_profile_role(array['admin', 'rh']))
with check (public.has_profile_role(array['admin', 'rh']));

grant select, insert, update, delete on public.unidades to authenticated;
grant select on public.vw_registros_dados_classificacao to authenticated;
grant select on public.vw_registros_dados_unidades to authenticated;
