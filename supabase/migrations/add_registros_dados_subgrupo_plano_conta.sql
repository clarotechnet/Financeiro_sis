-- Liga cada CPF/CNPJ cadastrado em registros_dados ao subgrupo correto do plano de contas.
-- Exemplo:
--   CPF operacional     -> 02-02-000 - MAO DE OBRA OPERACIONAL
--   CPF administrativo -> 03-01-000 - PESSOAL ADMINISTRATIVO
--
-- A conta analitica final continua sendo decidida na importacao da folha,
-- cruzando: CPF/CNPJ -> subgrupo -> evento/verba da folha.

do $$
begin
  if to_regclass('public.registros_dados') is null then
    raise exception 'A tabela public.registros_dados precisa existir antes desta migration.';
  end if;

  if to_regclass('public.plano_contas') is null then
    raise exception 'A tabela public.plano_contas precisa existir antes desta migration.';
  end if;
end $$;

alter table public.registros_dados
  add column if not exists subgrupo_plano_conta_id uuid null
  references public.plano_contas(id) on update cascade on delete set null;

comment on column public.registros_dados.subgrupo_plano_conta_id is
  'Subgrupo do plano de contas usado para classificar este CPF/CNPJ na importacao da folha. Deve apontar para uma conta nivel 2, como 02-02-000 ou 03-01-000.';

create index if not exists idx_registros_dados_subgrupo_plano_conta_id
  on public.registros_dados(subgrupo_plano_conta_id);

create index if not exists idx_registros_dados_cpf
  on public.registros_dados(cpf);

create or replace function public.validar_plano_conta_subgrupo(p_plano_conta_id uuid)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if p_plano_conta_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.plano_contas pc
    where pc.id = p_plano_conta_id
      and pc.nivel = 2
      and pc.e_analitica = false
      and pc.ativo = true
  ) then
    raise exception 'O subgrupo_plano_conta_id % deve apontar para um subgrupo ativo do plano de contas, como 02-02-000 ou 03-01-000.', p_plano_conta_id
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.trg_validar_registros_dados_subgrupo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.validar_plano_conta_subgrupo(new.subgrupo_plano_conta_id);
  return new;
end;
$$;

drop trigger if exists trg_registros_dados_subgrupo_plano_conta on public.registros_dados;
create trigger trg_registros_dados_subgrupo_plano_conta
before insert or update of subgrupo_plano_conta_id on public.registros_dados
for each row execute function public.trg_validar_registros_dados_subgrupo();

grant execute on function public.validar_plano_conta_subgrupo(uuid) to authenticated;

drop view if exists public.vw_registros_dados_classificacao;

create view public.vw_registros_dados_classificacao
with (security_invoker = on) as
select
  rd.id,
  rd.nome,
  rd.cpf,
  rd.setor,
  rd.subgrupo_plano_conta_id,

  s.codigo as subgrupo_codigo,
  s.descricao as subgrupo_descricao,
  s.natureza as subgrupo_natureza,

  g.id as grupo_id,
  g.codigo as grupo_codigo,
  g.descricao as grupo_descricao,
  g.natureza as grupo_natureza,

  rd.created_at,
  rd.updated_at
from public.registros_dados rd
left join public.plano_contas s on s.id = rd.subgrupo_plano_conta_id
left join public.plano_contas g on g.id = s.parent_id;

grant select on public.vw_registros_dados_classificacao to authenticated;
