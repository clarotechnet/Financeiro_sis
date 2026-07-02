-- Cadastro mestre de fornecedores usados nos lancamentos de pagamento.
-- Unidade e Centro de Custo apontam para os cadastros mestres atuais.

do $$
begin
  if to_regclass('public.unidades') is null then
    raise exception 'A tabela public.unidades precisa existir antes desta migration.';
  end if;

  if to_regclass('public.setor') is null then
    raise exception 'A tabela public.setor precisa existir antes desta migration.';
  end if;
end $$;

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null,
  nome text not null,
  unidade_codigo text not null,
  setor_codigo text not null,
  ativo boolean not null default true,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fornecedores_cnpj_not_blank check (btrim(cnpj) <> ''),
  constraint fornecedores_nome_not_blank check (btrim(nome) <> ''),
  constraint fornecedores_unidade_codigo_fkey
    foreign key (unidade_codigo)
    references public.unidades(codigo)
    on update cascade
    on delete restrict,
  constraint fornecedores_setor_codigo_fkey
    foreign key (setor_codigo)
    references public.setor(codigo)
    on update cascade
    on delete restrict
);

comment on table public.fornecedores is
  'Cadastro mestre de fornecedores para solicitacao de pagamento.';
comment on column public.fornecedores.cnpj is
  'CNPJ do fornecedor. No frontend e salvo somente com numeros.';
comment on column public.fornecedores.nome is
  'Nome/Razao social do fornecedor.';
comment on column public.fornecedores.unidade_codigo is
  'Codigo da unidade associada ao fornecedor.';
comment on column public.fornecedores.setor_codigo is
  'Codigo do centro de custo/setor associado ao fornecedor.';

create unique index if not exists idx_fornecedores_cnpj_ativo_unique
  on public.fornecedores (cnpj)
  where ativo = true;

create index if not exists idx_fornecedores_nome_lookup
  on public.fornecedores (lower(btrim(nome)))
  where ativo = true;

create index if not exists idx_fornecedores_unidade_codigo
  on public.fornecedores(unidade_codigo);

create index if not exists idx_fornecedores_setor_codigo
  on public.fornecedores(setor_codigo);

drop trigger if exists trg_fornecedores_updated_at on public.fornecedores;
create trigger trg_fornecedores_updated_at
before update on public.fornecedores
for each row execute function public.set_updated_at();

create or replace view public.vw_fornecedores
with (security_invoker = on) as
select
  f.id,
  f.cnpj,
  f.nome,
  f.unidade_codigo,
  u.unidade as unidade_nome,
  f.setor_codigo,
  s.setor as setor_nome,
  f.ativo,
  f.created_by,
  f.created_at,
  f.updated_at
from public.fornecedores f
left join public.unidades u on u.codigo = f.unidade_codigo
left join public.setor s on s.codigo = f.setor_codigo;

alter table public.fornecedores enable row level security;

drop policy if exists "approved users can read fornecedores" on public.fornecedores;
create policy "approved users can read fornecedores"
on public.fornecedores
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

drop policy if exists "admins can manage fornecedores" on public.fornecedores;
create policy "admins can manage fornecedores"
on public.fornecedores
for all
to authenticated
using (public.has_profile_role(array['admin']))
with check (public.has_profile_role(array['admin']));

grant select, insert, update, delete on public.fornecedores to authenticated;
grant select on public.vw_fornecedores to authenticated;
