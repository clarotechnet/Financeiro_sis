-- Novo fluxo contabil para Folha e Beneficios.
--
-- 1. Folha e Beneficios continuam sendo armazenados como dados operacionais.
-- 2. Eles deixam de alimentar a DRE diretamente.
-- 3. A DRE passa a recebe-los somente depois da importacao do relatorio
--    consolidado em public.lancamentos_pix com uma conta analitica escolhida.
-- 4. Colunas e tabelas antigas sao preservadas como legado para nao apagar
--    historico nem quebrar uma eventual reversao do fluxo.

do $$
begin
  if to_regclass('public.lancamentos_pix') is null then
    raise exception 'A tabela public.lancamentos_pix precisa existir antes desta migration.';
  end if;

  if to_regclass('public.beneficios_combustivel') is null
     or to_regclass('public.beneficios_agregamento') is null
     or to_regclass('public.beneficios_flash') is null then
    raise exception 'As tres tabelas de beneficios precisam existir antes desta migration.';
  end if;
end $$;

-- Rastreabilidade e protecao contra a importacao repetida do mesmo arquivo.
alter table public.lancamentos_pix
  add column if not exists relatorio_origem text null,
  add column if not exists relatorio_arquivo_nome text null,
  add column if not exists relatorio_importacao_chave text null;

comment on column public.lancamentos_pix.relatorio_origem is
  'Origem operacional do relatorio: folha_pagamento ou um dos tipos de beneficio.';
comment on column public.lancamentos_pix.relatorio_arquivo_nome is
  'Nome do arquivo de relatorio importado em Inclusao de Pagamentos.';
comment on column public.lancamentos_pix.relatorio_importacao_chave is
  'Chave unica composta pelo identificador do relatorio e pela linha do arquivo.';

create unique index if not exists uq_lancamentos_pix_relatorio_importacao_chave
  on public.lancamentos_pix(relatorio_importacao_chave)
  where relatorio_importacao_chave is not null;

-- Beneficios novos nao recebem conta analitica durante a importacao por CPF.
drop trigger if exists trg_beneficios_combustivel_plano_conta on public.beneficios_combustivel;
drop trigger if exists trg_beneficios_agregamento_plano_conta on public.beneficios_agregamento;
drop trigger if exists trg_beneficios_flash_plano_conta on public.beneficios_flash;

alter table public.beneficios_combustivel alter column plano_conta_id drop not null;
alter table public.beneficios_agregamento alter column plano_conta_id drop not null;
alter table public.beneficios_flash alter column plano_conta_id drop not null;

comment on column public.beneficios_combustivel.plano_conta_id is
  'LEGADO: nao e mais preenchido no novo fluxo. A conta e escolhida ao importar o relatorio.';
comment on column public.beneficios_agregamento.plano_conta_id is
  'LEGADO: nao e mais preenchido no novo fluxo. A conta e escolhida ao importar o relatorio.';
comment on column public.beneficios_flash.plano_conta_id is
  'LEGADO: nao e mais preenchido no novo fluxo. A conta e escolhida ao importar o relatorio.';

do $$
begin
  if to_regclass('public.folha_verba_mapeamentos') is not null then
    execute 'comment on table public.folha_verba_mapeamentos is '
      || quote_literal('LEGADO: o novo fluxo nao classifica verbas diretamente na DRE. Preservada para historico.');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registros_dados'
      and column_name = 'subgrupo_plano_conta_id'
  ) then
    execute 'comment on column public.registros_dados.subgrupo_plano_conta_id is '
      || quote_literal('LEGADO: nao e usado pelo novo fluxo de Folha e Beneficios para a DRE.');
  end if;
end $$;

-- As views mantem o mesmo contrato de colunas para preservar suas dependencias.
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
  b.placa
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
  null::text
from public.beneficios_flash b
left join public.unidades u on u.codigo = b.unidade_codigo
left join public.setor s on s.codigo = b.setor_codigo
left join public.vw_plano_contas_relatorio pc on pc.conta_id = b.plano_conta_id;

-- A DRE passa a considerar apenas Receitas e Lancamentos.
-- Folha e Beneficios entram depois, quando seus relatorios forem importados
-- em public.lancamentos_pix com plano_conta_id.
create or replace view public.vw_movimentos_dre
with (security_invoker = on) as
with movimentos as (
  select
    'receitas:' || r.id::text as id,
    r.id::text as origem_id,
    r.data_recebimento::date as data_movimento,
    coalesce(nullif(btrim(r.descricao), ''), nullif(btrim(r.cliente), ''), nullif(btrim(r.nome), ''), 'Receita') as descricao,
    case
      when r.conta_natureza = U&'Dedu\00E7\00E3o' then -abs(coalesce(r.valor, 0)::numeric)
      else abs(coalesce(r.valor, 0)::numeric)
    end as valor,
    r.plano_conta_id,
    r.unidade_codigo,
    r.unidade_nome,
    r.setor_codigo,
    r.setor_nome,
    'receitas'::text as origem,
    r.conta_codigo,
    r.conta_descricao,
    r.conta_natureza,
    r.subgrupo_codigo,
    r.subgrupo_descricao,
    r.grupo_codigo,
    r.grupo_descricao
  from public.vw_receitas_plano_contas r
  where coalesce(r.valor, 0) <> 0

  union all

  select
    'lancamentos_pix:' || p.id::text,
    p.id::text,
    p.data_lancamento::date,
    coalesce(nullif(btrim(p.descricao), ''), nullif(btrim(p.favorecido), ''), 'Lancamento'),
    -abs(coalesce(p.valor, 0)::numeric),
    p.plano_conta_id,
    p.unidade_codigo,
    p.unidade_cadastro,
    p.setor_codigo,
    p.setor_nome,
    'lancamentos_pix'::text,
    pc.conta_codigo,
    pc.conta_descricao,
    pc.conta_natureza,
    pc.subgrupo_codigo,
    pc.subgrupo_descricao,
    pc.grupo_codigo,
    pc.grupo_descricao
  from public.vw_lancamentos_pix_com_conta_analitica p
  left join public.vw_plano_contas_relatorio pc on pc.conta_id = p.plano_conta_id
  where coalesce(p.valor, 0) <> 0
    and (p.status_pag is null or p.status_pag not ilike 'cancel%')
)
select
  m.*,
  dl.id as dre_linha_id,
  dl.codigo as dre_linha_codigo,
  dl.descricao as dre_linha_descricao,
  dl.ordem as dre_linha_ordem
from movimentos m
left join public.dre_linha_contas dlc on dlc.plano_conta_id = m.plano_conta_id
left join public.dre_linhas dl on dl.id = dlc.dre_linha_id and dl.ativo = true;

create or replace view public.vw_movimentos_dre_pendencias
with (security_invoker = on) as
select *
from public.vw_movimentos_dre
where dre_linha_id is null;

grant select on public.vw_beneficios_plano_contas to authenticated;
grant select on public.vw_movimentos_dre to authenticated;
grant select on public.vw_movimentos_dre_pendencias to authenticated;
