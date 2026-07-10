-- Associa cada lancamento de receita a uma unidade cadastrada.

do $$
begin
  if to_regclass('public.receitas') is null then
    raise exception 'A tabela public.receitas precisa existir antes desta migration.';
  end if;

  if to_regclass('public.unidades') is null then
    raise exception 'A tabela public.unidades precisa existir antes desta migration.';
  end if;
end $$;

alter table public.receitas
  add column if not exists unidade_codigo text null;

comment on column public.receitas.unidade_codigo is
  'Codigo da unidade associada ao lancamento de receita. Referencia public.unidades(codigo).';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'receitas_unidade_codigo_fkey'
      and conrelid = 'public.receitas'::regclass
  ) then
    alter table public.receitas
      add constraint receitas_unidade_codigo_fkey
      foreign key (unidade_codigo)
      references public.unidades(codigo)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists idx_receitas_unidade_codigo
  on public.receitas(unidade_codigo);

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
  r.unidade_codigo,
  u.unidade as unidade_nome,
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
  on pc.conta_id = r.plano_conta_id
left join public.unidades u
  on u.codigo = r.unidade_codigo;

grant select on public.vw_receitas_plano_contas to authenticated;
