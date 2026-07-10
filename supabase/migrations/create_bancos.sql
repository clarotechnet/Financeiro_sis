-- Cadastro mestre de bancos usados nos lancamentos PIX.
-- O codigo e a chave de negocio; o nome continua salvo em lancamentos_pix.banco
-- para compatibilidade com dados legados e exportacoes atuais.

do $$
begin
  if to_regclass('public.lancamentos_pix') is null then
    raise exception 'A tabela public.lancamentos_pix precisa existir antes desta migration.';
  end if;
end $$;

create table if not exists public.bancos (
  codigo text primary key,
  banco text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bancos_codigo_not_blank check (btrim(codigo) <> ''),
  constraint bancos_banco_not_blank check (btrim(banco) <> '')
);

comment on table public.bancos is
  'Cadastro mestre de bancos usados como opcoes em lancamentos PIX.';
comment on column public.bancos.codigo is
  'Codigo do banco usado para associar lancamentos PIX.';
comment on column public.bancos.banco is
  'Nome do banco exibido nos filtros, formularios e dados detalhados.';

create unique index if not exists idx_bancos_banco_ativo_unique
  on public.bancos (upper(btrim(banco)))
  where ativo = true;

drop trigger if exists trg_bancos_updated_at on public.bancos;
create trigger trg_bancos_updated_at
before update on public.bancos
for each row execute function public.set_updated_at();

insert into public.bancos (codigo, banco)
values
  ('B001', 'SICREDI - DMV'),
  ('B002', 'MENTORE - DMV'),
  ('B003', 'MENTORE - VNA'),
  ('B004', 'MENTORE - RDT'),
  ('B005', 'BB - VNA'),
  ('B006', 'BB - RDT'),
  ('B007', 'BB - DMV SAC'),
  ('B008', 'BB - DMV CSW')
on conflict (codigo) do update
set
  banco = excluded.banco,
  ativo = true,
  updated_at = now();

alter table public.lancamentos_pix
  add column if not exists banco text null,
  add column if not exists banco_codigo text null;

comment on column public.lancamentos_pix.banco is
  'Nome do banco usado no lancamento PIX. Mantido para compatibilidade com dados legados.';
comment on column public.lancamentos_pix.banco_codigo is
  'Codigo do banco associado ao lancamento PIX. Referencia public.bancos(codigo).';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lancamentos_pix_banco_codigo_fkey'
      and conrelid = 'public.lancamentos_pix'::regclass
  ) then
    alter table public.lancamentos_pix
      add constraint lancamentos_pix_banco_codigo_fkey
      foreign key (banco_codigo)
      references public.bancos(codigo)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists idx_lancamentos_pix_banco_codigo
  on public.lancamentos_pix(banco_codigo);

update public.lancamentos_pix l
set banco_codigo = b.codigo
from public.bancos b
where l.banco_codigo is null
  and upper(btrim(coalesce(l.banco, ''))) = upper(btrim(b.banco));

create or replace view public.vw_lancamentos_pix_com_conta_analitica
with (security_invoker = on) as
select
  v.*,
  l.plano_conta_id,
  l.unidade_codigo,
  u.unidade as unidade_cadastro,
  l.setor_codigo,
  st.setor as setor_nome,
  pc.codigo as conta_analitica_codigo,
  pc.descricao as conta_analitica_descricao,
  case
    when pc.id is null then null
    else pc.codigo || ' - ' || pc.descricao
  end as conta_analitica,
  l.banco_codigo,
  b.banco as banco_cadastro
from public.vw_lancamentos_pix v
join public.lancamentos_pix l on l.id = v.id
left join public.unidades u on u.codigo = l.unidade_codigo
left join public.setor st on st.codigo = l.setor_codigo
left join public.plano_contas pc on pc.id = l.plano_conta_id
left join public.bancos b on b.codigo = l.banco_codigo;

alter table public.bancos enable row level security;

drop policy if exists "approved users can read bancos" on public.bancos;
create policy "approved users can read bancos"
on public.bancos
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

drop policy if exists "admin and rh can manage bancos" on public.bancos;
create policy "admin and rh can manage bancos"
on public.bancos
for all
to authenticated
using (public.has_profile_role(array['admin', 'rh']))
with check (public.has_profile_role(array['admin', 'rh']));

grant select, insert, update, delete on public.bancos to authenticated;
grant select on public.vw_lancamentos_pix_com_conta_analitica to authenticated;
