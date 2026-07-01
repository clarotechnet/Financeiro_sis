-- Cadastro mestre de setores.
-- O codigo e a chave usada para associar funcionarios em registros_dados.

do $$
begin
  if to_regclass('public.registros_dados') is null then
    raise exception 'A tabela public.registros_dados precisa existir antes desta migration.';
  end if;
end $$;

create table if not exists public.setor (
  codigo text primary key,
  setor text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint setor_codigo_not_blank check (btrim(codigo) <> ''),
  constraint setor_setor_not_blank check (btrim(setor) <> '')
);

comment on table public.setor is
  'Cadastro mestre de setores da empresa. O codigo funciona como chave para associar funcionarios.';
comment on column public.setor.codigo is
  'Codigo do setor usado para associar funcionarios em registros_dados.';
comment on column public.setor.setor is
  'Nome do setor.';

create unique index if not exists idx_setor_setor_ativo_unique
  on public.setor (upper(btrim(setor)))
  where ativo = true;

drop trigger if exists trg_setor_updated_at on public.setor;
create trigger trg_setor_updated_at
before update on public.setor
for each row execute function public.set_updated_at();

insert into public.setor (codigo, setor)
values
  ('S001', 'Técnico de Campo — ADS & SERVIÇOS'),
  ('S002', 'Técnico de Campo — Desconexão'),
  ('S003', 'Técnico de Campo — VT por equipe'),
  ('S004', 'Técnico de Campo — MDU - Manutenção'),
  ('S005', 'Técnico de Campo — MDU - Construção'),
  ('S006', 'Técnica — Consultivo'),
  ('S007', 'Suporte de Campo  — ADS & SERVIÇOS'),
  ('S008', 'Suporte de Campo — Desconexão'),
  ('S009', 'Suporte de Campo — VT por equipe'),
  ('S010', 'Suporte de Campo — MDU - Manutenção'),
  ('S011', 'Suporte de Campo — MDU - Construção'),
  ('S012', 'Comercial PPAP'),
  ('S013', 'Comercial TELEMARKETING'),
  ('S014', 'Comercial P1'),
  ('S015', 'Comercial P2'),
  ('S016', 'Comercial Bônus FPD'),
  ('S017', 'Comercial Bônus VPC'),
  ('S018', 'Manutenção / Suporte / Garantia'),
  ('S019', 'Administrativo'),
  ('S020', 'DP / RH'),
  ('S021', 'Financeiro'),
  ('S022', 'Diretoria / Sócios')
on conflict (codigo) do update
set
  setor = excluded.setor,
  ativo = true,
  updated_at = now();

alter table public.registros_dados
  add column if not exists setor_codigo text null;

comment on column public.registros_dados.setor_codigo is
  'Codigo do setor associado ao funcionario/CPF. Referencia public.setor(codigo).';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'registros_dados_setor_codigo_fkey'
      and conrelid = 'public.registros_dados'::regclass
  ) then
    alter table public.registros_dados
      add constraint registros_dados_setor_codigo_fkey
      foreign key (setor_codigo)
      references public.setor(codigo)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists idx_registros_dados_setor_codigo
  on public.registros_dados(setor_codigo);

update public.registros_dados rd
set setor_codigo = s.codigo
from public.setor s
where rd.setor_codigo is null
  and upper(btrim(coalesce(rd.setor, ''))) = upper(btrim(s.setor));

drop view if exists public.vw_registros_dados_classificacao;

create view public.vw_registros_dados_classificacao
with (security_invoker = on) as
select
  rd.id,
  rd.nome,
  rd.cpf,
  rd.setor as setor_legado,
  rd.setor_codigo,
  st.setor as setor_nome,
  coalesce(st.setor, rd.setor) as setor,
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
left join public.setor st on st.codigo = rd.setor_codigo
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
  rd.setor as setor_legado,
  rd.setor_codigo,
  st.setor as setor_nome,
  coalesce(st.setor, rd.setor) as setor,
  rd.unidade_codigo,
  u.unidade as unidade_nome,
  u.ativo as unidade_ativa,
  rd.created_at,
  rd.updated_at
from public.registros_dados rd
left join public.setor st on st.codigo = rd.setor_codigo
left join public.unidades u on u.codigo = rd.unidade_codigo;

alter table public.setor enable row level security;

drop policy if exists "approved users can read setor" on public.setor;
create policy "approved users can read setor"
on public.setor
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

drop policy if exists "admin and rh can manage setor" on public.setor;
create policy "admin and rh can manage setor"
on public.setor
for all
to authenticated
using (public.has_profile_role(array['admin', 'rh']))
with check (public.has_profile_role(array['admin', 'rh']));

grant select, insert, update, delete on public.setor to authenticated;
grant select on public.vw_registros_dados_classificacao to authenticated;
grant select on public.vw_registros_dados_unidades to authenticated;
