-- Atualiza a importacao operacional da Folha para o novo arquivo de liquidos.
-- A data passa a ser informada no frontend e gravada em todas as linhas importadas.
-- Estas verbas nao alimentam a DRE diretamente; a entrada contabil continua sendo
-- feita pelo relatorio consolidado importado em Inclusao de Pagamentos.

do $$
begin
  if to_regclass('public.dados_financeiro') is null then
    raise exception 'A tabela public.dados_financeiro precisa existir antes desta migration.';
  end if;

  if to_regclass('public.registros_dados') is null then
    raise exception 'A tabela public.registros_dados precisa existir antes desta migration.';
  end if;
end $$;

alter table public.dados_financeiro
  add column if not exists pro_labore numeric not null default 0,
  add column if not exists quinquenio numeric not null default 0,
  add column if not exists distribuicao_lucros numeric not null default 0,
  add column if not exists reflexo_extras_dsr numeric not null default 0,
  add column if not exists estouro_mes numeric not null default 0,
  add column if not exists diferenca_um_terco_ferias numeric not null default 0,
  add column if not exists diferenca_media_hora_ferias numeric not null default 0,
  add column if not exists horas_afast_doenca_integral numeric not null default 0,
  add column if not exists media_afast_doenca_integral numeric not null default 0,
  add column if not exists periculosidade_proporcional numeric not null default 0,
  add column if not exists inss_diferenca_ferias numeric not null default 0,
  add column if not exists inss_empregador numeric not null default 0,
  add column if not exists irrf_empregador numeric not null default 0,
  add column if not exists inss numeric not null default 0;

comment on column public.dados_financeiro.pro_labore is 'Verba PRO-LABORE da folha importada.';
comment on column public.dados_financeiro.quinquenio is 'Verba QUINQUENIO da folha importada.';
comment on column public.dados_financeiro.inss is 'Verba I.N.S.S. do novo arquivo; separada da coluna legada desc_inss.';

create or replace view public.vw_dados_financeiro_operacional
with (security_invoker = on) as
select
  df.id,
  df.data,
  df.nome,
  df.cpf,
  rd.id as registro_id,
  rd.nome as nome_registro,
  coalesce(s.setor, rd.setor) as setor,
  rd.setor_codigo,
  s.setor as setor_nome,
  rd.unidade_codigo,
  u.unidade as unidade_nome,
  df.sal_folha,
  df.sal_familia,
  df.desc_inss,
  df.inss,
  df.irrf,
  df.ferias,
  df.decimo_terceiro,
  df.periculosidade,
  df.hora_extra_50,
  df.hora_extra_60,
  df.hora_extra_70,
  df.hora_extra_100,
  df.dsr,
  df.sal_maternidade,
  df.vale_transporte,
  df.desc_plano_saude,
  df.desc_vale_alimentacao,
  df.desc_odonto,
  df.desc_faltas,
  df.desc_adiantamento,
  df.contribuicao,
  df.desc_pensao,
  df.dif_salario,
  df.emprestimo,
  df.desc_fardamento,
  df.demais_desc,
  df.pro_labore,
  df.quinquenio,
  df.distribuicao_lucros,
  df.reflexo_extras_dsr,
  df.estouro_mes,
  df.diferenca_um_terco_ferias,
  df.diferenca_media_hora_ferias,
  df.horas_afast_doenca_integral,
  df.media_afast_doenca_integral,
  df.periculosidade_proporcional,
  df.inss_diferenca_ferias,
  df.inss_empregador,
  df.irrf_empregador,
  df.total_proventos,
  df.total_descontos,
  df.salario_liquido
from public.dados_financeiro df
left join public.registros_dados rd
  on regexp_replace(coalesce(rd.cpf, ''), '\D', '', 'g') =
     regexp_replace(coalesce(df.cpf, ''), '\D', '', 'g')
left join public.unidades u on u.codigo = rd.unidade_codigo
left join public.setor s on s.codigo = rd.setor_codigo;

comment on view public.vw_dados_financeiro_operacional is
  'Leitura operacional da Folha com cadastro, unidade, centro de custo e todas as verbas importadas.';

grant select on public.vw_dados_financeiro_operacional to authenticated;
