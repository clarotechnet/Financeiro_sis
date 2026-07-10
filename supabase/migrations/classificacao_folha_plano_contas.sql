-- Mapeamento inicial das verbas da folha para o plano de contas.
--
-- A folha tem varias verbas na mesma linha. Por isso a classificacao para DRE
-- precisa gerar uma linha por verba, nao apenas um plano_conta_id na linha inteira.
--
-- Regra:
--   CPF/CNPJ -> registros_dados.subgrupo_plano_conta_id
--   verba da folha -> folha_verba_mapeamentos.descricao_conta
--   subgrupo/grupo + descricao_conta -> conta analitica do plano de contas

do $$
begin
  if to_regclass('public.dados_financeiro') is null then
    raise exception 'A tabela public.dados_financeiro precisa existir antes desta migration.';
  end if;

  if to_regclass('public.registros_dados') is null then
    raise exception 'A tabela public.registros_dados precisa existir antes desta migration.';
  end if;

  if to_regclass('public.plano_contas') is null then
    raise exception 'A tabela public.plano_contas precisa existir antes desta migration.';
  end if;
end $$;

alter table public.dados_financeiro
  add column if not exists sal_familia numeric null default 0,
  add column if not exists desc_vale_alimentacao numeric null default 0,
  add column if not exists demais_desc numeric null default 0;

create table if not exists public.folha_verba_mapeamentos (
  campo_folha text primary key,
  label_folha text not null,
  descricao_conta text null,
  ativo boolean not null default true,
  observacao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.folha_verba_mapeamentos is
  'Dicionario de verbas/colunas da folha para descricao da conta analitica no plano de contas.';
comment on column public.folha_verba_mapeamentos.campo_folha is
  'Nome tecnico da coluna em dados_financeiro.';
comment on column public.folha_verba_mapeamentos.descricao_conta is
  'Descricao da conta analitica a procurar no subgrupo/grupo do CPF. Quando null, a verba fica pendente de classificacao.';

drop trigger if exists trg_folha_verba_mapeamentos_updated_at on public.folha_verba_mapeamentos;
create trigger trg_folha_verba_mapeamentos_updated_at
before update on public.folha_verba_mapeamentos
for each row execute function public.set_updated_at();

insert into public.folha_verba_mapeamentos (campo_folha, label_folha, descricao_conta, observacao)
values
  ('sal_folha', 'Sal. Folha', null, 'Pendente de validacao com financeiro.'),
  ('sal_familia', 'Sal. Familia', null, 'Pendente de validacao com financeiro.'),
  ('sal_maternidade', 'Sal. Maternidade', null, 'Pendente de validacao com financeiro.'),
  ('desc_inss', 'Desc INSS', 'INSS — FOLHA DE PAGAMENTO', null),
  ('irrf', 'IRRF', 'IRRF — FOLHA', null),
  ('ferias', 'Ferias', 'FÉRIAS', null),
  ('decimo_terceiro', '13º Salario', '13º SALÁRIO', null),
  ('periculosidade', 'Periculosidade', 'ADICIONAL DE PERICULOSIDADE', null),
  ('hora_extra_50', 'Hora Extra 50%', 'HORA EXTRA', null),
  ('hora_extra_60', 'Hora Extra 60%', 'HORA EXTRA', null),
  ('hora_extra_70', 'Hora Extra 70%', 'HORA EXTRA', null),
  ('hora_extra_100', 'Hora Extra 100%', 'HORA EXTRA', null),
  ('vale_transporte', 'Vale transporte', 'VALE TRANSPORTE', null),
  ('desc_plano_saude', 'Desc plano de Saude', 'PLANO DE SAÚDE', null),
  ('desc_vale_alimentacao', 'Desc vale alimentacao', 'ALIMENTAÇÃO', null),
  ('desc_odonto', 'Desc Odonto', 'ASSISTÊNCIA ODONTOLÓGICA', null),
  ('desc_faltas', 'Desc faltas', null, 'Pendente de validacao com financeiro.'),
  ('desc_adiantamento', 'Desc adiantamento', null, 'Pendente de validacao com financeiro.'),
  ('dsr', 'DSR', null, 'Pendente de validacao com financeiro.'),
  ('dif_salario', 'Dif. Salario', null, 'Pendente de validacao com financeiro.'),
  ('emprestimo', 'Emprestimo', null, 'Pendente de validacao com financeiro.'),
  ('desc_fardamento', 'Desc fardamento', null, 'Pendente de validacao com financeiro.'),
  ('demais_desc', 'Demais desc', null, 'Pendente de validacao com financeiro.'),
  ('contribuicao', 'Contribuicao sindical', 'CONTRIBUIÇÃO SINDICAL', 'Validar se deve ser CONTRIBUIÇÃO SINDICAL ou CONTRIBUIÇÃO SINDICAL PATRONAL.'),
  ('desc_pensao', 'Pensao', 'PENSÃO ALIMENTÍCIA', null),
  ('salario_liquido', 'Salario Liquido', 'SALÁRIOS', 'Validar com financeiro para evitar duplicidade com verbas detalhadas.'),
  ('total_descontos', 'T. descontos', null, 'Totalizador: pendente de validacao; geralmente nao deve compor DRE junto com verbas detalhadas.'),
  ('total_proventos', 'T. proventos', null, 'Totalizador: pendente de validacao; geralmente nao deve compor DRE junto com verbas detalhadas.')
on conflict (campo_folha) do update
set
  label_folha = excluded.label_folha,
  descricao_conta = excluded.descricao_conta,
  observacao = excluded.observacao,
  updated_at = now();

create index if not exists idx_folha_verba_mapeamentos_ativo
  on public.folha_verba_mapeamentos(ativo)
  where ativo = true;

drop view if exists public.vw_dados_financeiro_plano_contas;

create view public.vw_dados_financeiro_plano_contas
with (security_invoker = on) as
with base as (
  select
    df.*,
    rd.id as registro_id_resolvido,
    rd.nome as nome_registro_resolvido,
    rd.setor as setor_resolvido,
    rd.subgrupo_plano_conta_id
  from public.dados_financeiro df
  left join public.registros_dados rd
    on regexp_replace(coalesce(rd.cpf, ''), '\D', '', 'g') = regexp_replace(coalesce(df.cpf, ''), '\D', '', 'g')
),
verbas as (
  select
    b.id as dados_financeiro_id,
    b.data,
    b.nome,
    b.cpf,
    b.registro_id_resolvido as registro_id,
    b.nome_registro_resolvido as nome_registro,
    b.setor_resolvido as setor,
    b.subgrupo_plano_conta_id,
    v.campo_folha,
    v.valor
  from base b
  cross join lateral (
    values
      ('sal_folha', coalesce(b.sal_folha, 0)::numeric),
      ('sal_familia', coalesce(b.sal_familia, 0)::numeric),
      ('sal_maternidade', coalesce(b.sal_maternidade, 0)::numeric),
      ('desc_inss', coalesce(b.desc_inss, 0)::numeric),
      ('irrf', coalesce(b.irrf, 0)::numeric),
      ('ferias', coalesce(b.ferias, 0)::numeric),
      ('decimo_terceiro', coalesce(b.decimo_terceiro, 0)::numeric),
      ('periculosidade', coalesce(b.periculosidade, 0)::numeric),
      ('hora_extra_50', coalesce(b.hora_extra_50, 0)::numeric),
      ('hora_extra_60', coalesce(b.hora_extra_60, 0)::numeric),
      ('hora_extra_70', coalesce(b.hora_extra_70, 0)::numeric),
      ('hora_extra_100', coalesce(b.hora_extra_100, 0)::numeric),
      ('vale_transporte', coalesce(b.vale_transporte, 0)::numeric),
      ('desc_plano_saude', coalesce(b.desc_plano_saude, 0)::numeric),
      ('desc_vale_alimentacao', coalesce(b.desc_vale_alimentacao, 0)::numeric),
      ('desc_odonto', coalesce(b.desc_odonto, 0)::numeric),
      ('desc_faltas', coalesce(b.desc_faltas, 0)::numeric),
      ('desc_adiantamento', coalesce(b.desc_adiantamento, 0)::numeric),
      ('dsr', coalesce(b.dsr, 0)::numeric),
      ('dif_salario', coalesce(b.dif_salario, 0)::numeric),
      ('emprestimo', coalesce(b.emprestimo, 0)::numeric),
      ('desc_fardamento', coalesce(b.desc_fardamento, 0)::numeric),
      ('demais_desc', coalesce(b.demais_desc, 0)::numeric),
      ('contribuicao', coalesce(b.contribuicao, 0)::numeric),
      ('desc_pensao', coalesce(b.desc_pensao, 0)::numeric),
      ('salario_liquido', coalesce(b.salario_liquido, 0)::numeric),
      ('total_descontos', coalesce(b.total_descontos, 0)::numeric),
      ('total_proventos', coalesce(b.total_proventos, 0)::numeric)
  ) as v(campo_folha, valor)
  where v.valor <> 0
)
select
  v.dados_financeiro_id,
  v.data,
  v.nome,
  v.cpf,
  v.registro_id,
  v.nome_registro,
  v.setor,
  v.subgrupo_plano_conta_id,
  m.campo_folha,
  m.label_folha,
  m.descricao_conta as descricao_conta_mapeada,
  v.valor,

  pc.conta_id as plano_conta_id,
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
  pc.caminho_descricao
from verbas v
join public.folha_verba_mapeamentos m
  on m.campo_folha = v.campo_folha
 and m.ativo = true
 and m.descricao_conta is not null
join public.plano_contas s
  on s.id = v.subgrupo_plano_conta_id
left join lateral (
  select r.*
  from public.vw_plano_contas_relatorio r
  where upper(btrim(r.conta_descricao)) = upper(btrim(m.descricao_conta))
    and (
      r.subgrupo_id = v.subgrupo_plano_conta_id
      or r.grupo_id = s.parent_id
    )
  order by
    case when r.subgrupo_id = v.subgrupo_plano_conta_id then 0 else 1 end,
    r.conta_codigo
  limit 1
) pc on true
where pc.conta_id is not null;

drop view if exists public.vw_dados_financeiro_classificacao_pendencias;

create view public.vw_dados_financeiro_classificacao_pendencias
with (security_invoker = on) as
with base as (
  select
    df.*,
    rd.id as registro_id_resolvido,
    rd.nome as nome_registro_resolvido,
    rd.setor as setor_resolvido,
    rd.subgrupo_plano_conta_id
  from public.dados_financeiro df
  left join public.registros_dados rd
    on regexp_replace(coalesce(rd.cpf, ''), '\D', '', 'g') = regexp_replace(coalesce(df.cpf, ''), '\D', '', 'g')
),
verbas as (
  select
    b.id as dados_financeiro_id,
    b.data,
    b.nome,
    b.cpf,
    b.registro_id_resolvido as registro_id,
    b.nome_registro_resolvido as nome_registro,
    b.setor_resolvido as setor,
    b.subgrupo_plano_conta_id,
    v.campo_folha,
    v.valor
  from base b
  cross join lateral (
    values
      ('sal_folha', coalesce(b.sal_folha, 0)::numeric),
      ('sal_familia', coalesce(b.sal_familia, 0)::numeric),
      ('sal_maternidade', coalesce(b.sal_maternidade, 0)::numeric),
      ('desc_inss', coalesce(b.desc_inss, 0)::numeric),
      ('irrf', coalesce(b.irrf, 0)::numeric),
      ('ferias', coalesce(b.ferias, 0)::numeric),
      ('decimo_terceiro', coalesce(b.decimo_terceiro, 0)::numeric),
      ('periculosidade', coalesce(b.periculosidade, 0)::numeric),
      ('hora_extra_50', coalesce(b.hora_extra_50, 0)::numeric),
      ('hora_extra_60', coalesce(b.hora_extra_60, 0)::numeric),
      ('hora_extra_70', coalesce(b.hora_extra_70, 0)::numeric),
      ('hora_extra_100', coalesce(b.hora_extra_100, 0)::numeric),
      ('vale_transporte', coalesce(b.vale_transporte, 0)::numeric),
      ('desc_plano_saude', coalesce(b.desc_plano_saude, 0)::numeric),
      ('desc_vale_alimentacao', coalesce(b.desc_vale_alimentacao, 0)::numeric),
      ('desc_odonto', coalesce(b.desc_odonto, 0)::numeric),
      ('desc_faltas', coalesce(b.desc_faltas, 0)::numeric),
      ('desc_adiantamento', coalesce(b.desc_adiantamento, 0)::numeric),
      ('dsr', coalesce(b.dsr, 0)::numeric),
      ('dif_salario', coalesce(b.dif_salario, 0)::numeric),
      ('emprestimo', coalesce(b.emprestimo, 0)::numeric),
      ('desc_fardamento', coalesce(b.desc_fardamento, 0)::numeric),
      ('demais_desc', coalesce(b.demais_desc, 0)::numeric),
      ('contribuicao', coalesce(b.contribuicao, 0)::numeric),
      ('desc_pensao', coalesce(b.desc_pensao, 0)::numeric),
      ('salario_liquido', coalesce(b.salario_liquido, 0)::numeric),
      ('total_descontos', coalesce(b.total_descontos, 0)::numeric),
      ('total_proventos', coalesce(b.total_proventos, 0)::numeric)
  ) as v(campo_folha, valor)
  where v.valor <> 0
)
select
  v.dados_financeiro_id,
  v.data,
  v.nome,
  v.cpf,
  v.registro_id,
  v.nome_registro,
  v.setor,
  v.subgrupo_plano_conta_id,
  v.campo_folha,
  coalesce(m.label_folha, v.campo_folha) as label_folha,
  m.descricao_conta as descricao_conta_mapeada,
  v.valor,
  case
    when v.registro_id is null then 'cpf_nao_encontrado_em_registros_dados'
    when v.subgrupo_plano_conta_id is null then 'cpf_sem_subgrupo_plano_conta'
    when m.campo_folha is null then 'verba_sem_linha_no_mapeamento'
    when m.ativo = false then 'mapeamento_inativo'
    when m.descricao_conta is null then 'verba_sem_descricao_conta'
    when pc.conta_id is null then 'conta_nao_encontrada_no_subgrupo_ou_grupo'
    else 'pendente'
  end as motivo
from verbas v
left join public.folha_verba_mapeamentos m
  on m.campo_folha = v.campo_folha
left join public.plano_contas s
  on s.id = v.subgrupo_plano_conta_id
left join lateral (
  select r.*
  from public.vw_plano_contas_relatorio r
  where m.ativo = true
    and m.descricao_conta is not null
    and upper(btrim(r.conta_descricao)) = upper(btrim(m.descricao_conta))
    and (
      r.subgrupo_id = v.subgrupo_plano_conta_id
      or r.grupo_id = s.parent_id
    )
  order by
    case when r.subgrupo_id = v.subgrupo_plano_conta_id then 0 else 1 end,
    r.conta_codigo
  limit 1
) pc on true
where pc.conta_id is null;

alter table public.folha_verba_mapeamentos enable row level security;

drop policy if exists "approved users can read folha_verba_mapeamentos" on public.folha_verba_mapeamentos;
create policy "approved users can read folha_verba_mapeamentos"
on public.folha_verba_mapeamentos
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

drop policy if exists "admins can manage folha_verba_mapeamentos" on public.folha_verba_mapeamentos;
create policy "admins can manage folha_verba_mapeamentos"
on public.folha_verba_mapeamentos
for all
to authenticated
using (public.has_profile_role(array['admin']))
with check (public.has_profile_role(array['admin']));

grant select on public.folha_verba_mapeamentos to authenticated;
grant insert, update, delete on public.folha_verba_mapeamentos to authenticated;
grant select on public.vw_dados_financeiro_plano_contas to authenticated;
grant select on public.vw_dados_financeiro_classificacao_pendencias to authenticated;
