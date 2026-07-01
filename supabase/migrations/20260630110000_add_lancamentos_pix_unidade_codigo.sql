-- Associa lancamentos PIX a tabela mestre de unidades.
-- A coluna antiga unidade_id fica preservada para compatibilidade com dados legados.

do $$
begin
  if to_regclass('public.lancamentos_pix') is null then
    raise exception 'A tabela public.lancamentos_pix precisa existir antes desta migration.';
  end if;

  if to_regclass('public.unidades') is null then
    raise exception 'A tabela public.unidades precisa existir antes desta migration.';
  end if;
end $$;

alter table public.lancamentos_pix
  add column if not exists unidade_codigo text null;

comment on column public.lancamentos_pix.unidade_codigo is
  'Codigo da unidade associada ao lancamento PIX. Referencia public.unidades(codigo).';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lancamentos_pix'
      and column_name = 'unidade_id'
  ) then
    alter table public.lancamentos_pix alter column unidade_id drop not null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lancamentos_pix_unidade_codigo_fkey'
      and conrelid = 'public.lancamentos_pix'::regclass
  ) then
    alter table public.lancamentos_pix
      add constraint lancamentos_pix_unidade_codigo_fkey
      foreign key (unidade_codigo)
      references public.unidades(codigo)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists idx_lancamentos_pix_unidade_codigo
  on public.lancamentos_pix(unidade_codigo);

drop view if exists public.vw_lancamentos_pix_com_conta_analitica;

create view public.vw_lancamentos_pix_com_conta_analitica
with (security_invoker = on) as
select
  v.*,
  l.plano_conta_id,
  l.unidade_codigo,
  u.unidade as unidade_cadastro,
  pc.codigo as conta_analitica_codigo,
  pc.descricao as conta_analitica_descricao,
  case
    when pc.id is null then null
    else pc.codigo || ' - ' || pc.descricao
  end as conta_analitica
from public.vw_lancamentos_pix v
join public.lancamentos_pix l on l.id = v.id
left join public.unidades u on u.codigo = l.unidade_codigo
left join public.plano_contas pc on pc.id = l.plano_conta_id;

grant select on public.vw_lancamentos_pix_com_conta_analitica to authenticated;
