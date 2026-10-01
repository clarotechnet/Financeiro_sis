alter table public.beneficios_flash
  add column if not exists tipo_beneficio text null;

comment on column public.beneficios_flash.tipo_beneficio is
  'Tipo de beneficio Flash escolhido para todas as linhas do arquivo importado.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.beneficios_flash'::regclass
      and conname = 'beneficios_flash_tipo_beneficio_check'
  ) then
    alter table public.beneficios_flash
      add constraint beneficios_flash_tipo_beneficio_check
      check (
        tipo_beneficio is null
        or tipo_beneficio in (
          'Flash Hora Extra',
          'Flash Bonificação',
          'Flash Tec Consultivo',
          'Flash Gatilho',
          'Flash Ind de vendas',
          'Flash Produtividade',
          'Flash VT',
          'Flash VA'
        )
      );
  end if;
end $$;

create or replace view public.vw_beneficios_plano_contas
with (security_invoker = on) as
select
  'combustivel'::text as tipo,
  'Combustivel'::text as tipo_label,
  b.id,
  b.data_beneficio,
  b.cpf,
  b.nome,
  b.unidade_codigo,
  u.unidade as unidade_nome,
  b.setor_codigo,
  s.setor as setor_nome,
  b.plano_conta_id,
  b.valor,
  b.arquivo_nome,
  b.created_by,
  b.created_at,
  b.updated_at,
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
  case when pc.conta_id is null then null else pc.conta_codigo || ' - ' || pc.conta_descricao end as conta_analitica,
  case when pc.grupo_id is null then null else pc.grupo_codigo || ' - ' || pc.grupo_descricao end as grupo_conta,
  case when pc.subgrupo_id is null then null else pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao end as subgrupo_conta,
  b.placa,
  null::text as tipo_beneficio
from public.beneficios_combustivel b
left join public.unidades u on u.codigo = b.unidade_codigo
left join public.setor s on s.codigo = b.setor_codigo
left join public.vw_plano_contas_relatorio pc on pc.conta_id = b.plano_conta_id

union all

select
  'agregamento'::text,
  'Agregamento'::text,
  b.id,
  b.data_beneficio,
  b.cpf,
  b.nome,
  b.unidade_codigo,
  u.unidade,
  b.setor_codigo,
  s.setor,
  b.plano_conta_id,
  b.valor,
  b.arquivo_nome,
  b.created_by,
  b.created_at,
  b.updated_at,
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
  case when pc.conta_id is null then null else pc.conta_codigo || ' - ' || pc.conta_descricao end,
  case when pc.grupo_id is null then null else pc.grupo_codigo || ' - ' || pc.grupo_descricao end,
  case when pc.subgrupo_id is null then null else pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao end,
  null::text,
  null::text
from public.beneficios_agregamento b
left join public.unidades u on u.codigo = b.unidade_codigo
left join public.setor s on s.codigo = b.setor_codigo
left join public.vw_plano_contas_relatorio pc on pc.conta_id = b.plano_conta_id

union all

select
  'flash'::text,
  'Flash'::text,
  b.id,
  b.data_beneficio,
  b.cpf,
  b.nome,
  b.unidade_codigo,
  u.unidade,
  b.setor_codigo,
  s.setor,
  b.plano_conta_id,
  b.valor,
  b.arquivo_nome,
  b.created_by,
  b.created_at,
  b.updated_at,
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
  case when pc.conta_id is null then null else pc.conta_codigo || ' - ' || pc.conta_descricao end,
  case when pc.grupo_id is null then null else pc.grupo_codigo || ' - ' || pc.grupo_descricao end,
  case when pc.subgrupo_id is null then null else pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao end,
  null::text,
  b.tipo_beneficio
from public.beneficios_flash b
left join public.unidades u on u.codigo = b.unidade_codigo
left join public.setor s on s.codigo = b.setor_codigo
left join public.vw_plano_contas_relatorio pc on pc.conta_id = b.plano_conta_id;

grant select on public.vw_beneficios_plano_contas to authenticated;
