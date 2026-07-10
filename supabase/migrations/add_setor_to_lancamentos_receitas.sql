-- Associa lancamentos PIX e receitas a tabela mestre de setores.
-- As colunas antigas de centro de custo ficam preservadas para dados legados.

do $$
begin
  if to_regclass('public.setor') is null then
    raise exception 'A tabela public.setor precisa existir antes desta migration.';
  end if;

  if to_regclass('public.lancamentos_pix') is null then
    raise exception 'A tabela public.lancamentos_pix precisa existir antes desta migration.';
  end if;

  if to_regclass('public.receitas') is null then
    raise exception 'A tabela public.receitas precisa existir antes desta migration.';
  end if;
end $$;

alter table public.lancamentos_pix
  add column if not exists setor_codigo text null;

alter table public.receitas
  add column if not exists setor_codigo text null;

comment on column public.lancamentos_pix.setor_codigo is
  'Codigo do setor/centro de custo associado ao lancamento PIX. Referencia public.setor(codigo).';
comment on column public.receitas.setor_codigo is
  'Codigo do setor/centro de custo associado ao lancamento de receita. Referencia public.setor(codigo).';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lancamentos_pix'
      and column_name = 'centro_de_custo_id'
  ) then
    alter table public.lancamentos_pix alter column centro_de_custo_id drop not null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'lancamentos_pix_setor_codigo_fkey'
      and conrelid = 'public.lancamentos_pix'::regclass
  ) then
    alter table public.lancamentos_pix
      add constraint lancamentos_pix_setor_codigo_fkey
      foreign key (setor_codigo)
      references public.setor(codigo)
      on update cascade
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'receitas_setor_codigo_fkey'
      and conrelid = 'public.receitas'::regclass
  ) then
    alter table public.receitas
      add constraint receitas_setor_codigo_fkey
      foreign key (setor_codigo)
      references public.setor(codigo)
      on update cascade
      on delete restrict;
  end if;
end $$;

create index if not exists idx_lancamentos_pix_setor_codigo
  on public.lancamentos_pix(setor_codigo);

create index if not exists idx_receitas_setor_codigo
  on public.receitas(setor_codigo);

drop view if exists public.vw_lancamentos_pix_com_conta_analitica;

create view public.vw_lancamentos_pix_com_conta_analitica
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
  end as conta_analitica
from public.vw_lancamentos_pix v
join public.lancamentos_pix l on l.id = v.id
left join public.unidades u on u.codigo = l.unidade_codigo
left join public.setor st on st.codigo = l.setor_codigo
left join public.plano_contas pc on pc.id = l.plano_conta_id;

grant select on public.vw_lancamentos_pix_com_conta_analitica to authenticated;

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
  r.setor_codigo,
  st.setor as setor_nome,
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
  on u.codigo = r.unidade_codigo
left join public.setor st
  on st.codigo = r.setor_codigo;

grant select on public.vw_receitas_plano_contas to authenticated;
