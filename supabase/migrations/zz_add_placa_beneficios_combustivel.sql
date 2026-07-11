-- Adiciona a placa apenas aos beneficios de combustivel.
-- Agregamento continua usando somente CPF e Valor.

do $$
begin
  if to_regclass('public.beneficios_combustivel') is null then
    raise exception 'A tabela public.beneficios_combustivel precisa existir antes desta migration.';
  end if;

  if to_regclass('public.beneficios_agregamento') is null then
    raise exception 'A tabela public.beneficios_agregamento precisa existir antes desta migration.';
  end if;
end $$;

alter table public.beneficios_combustivel
  add column if not exists placa text null;

comment on column public.beneficios_combustivel.placa is
  'Placa informada no arquivo de combustivel.';

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
  pc.conta_codigo || ' - ' || pc.conta_descricao as conta_analitica,
  pc.grupo_codigo || ' - ' || pc.grupo_descricao as grupo_conta,
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta,
  b.placa
from public.beneficios_combustivel b
left join public.unidades u
  on u.codigo = b.unidade_codigo
left join public.setor s
  on s.codigo = b.setor_codigo
join public.vw_plano_contas_relatorio pc
  on pc.conta_id = b.plano_conta_id

union all

select
  'agregamento'::text as tipo,
  'Agregamento'::text as tipo_label,
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
  pc.conta_codigo || ' - ' || pc.conta_descricao as conta_analitica,
  pc.grupo_codigo || ' - ' || pc.grupo_descricao as grupo_conta,
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta,
  null::text as placa
from public.beneficios_agregamento b
left join public.unidades u
  on u.codigo = b.unidade_codigo
left join public.setor s
  on s.codigo = b.setor_codigo
join public.vw_plano_contas_relatorio pc
  on pc.conta_id = b.plano_conta_id;

grant select on public.vw_beneficios_plano_contas to authenticated;
