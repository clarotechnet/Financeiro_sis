-- Ajustes complementares para a migration do plano de contas
-- Rode depois de:
-- 20260624193000_create_plano_contas.sql
-- 20260624193500_seed_plano_contas.sql

-- 1) Recria a view principal como security_invoker para evitar alerta de Security Definer View no Supabase.
drop view if exists public.vw_plano_contas_hierarquia;

create view public.vw_plano_contas_hierarquia
with (security_invoker = on) as
select
  c.id,
  c.codigo,
  c.descricao,
  c.natureza,
  c.nivel,
  c.e_analitica,
  c.ativo,
  c.ordem,
  c.parent_id,

  p.codigo as codigo_pai,
  p.descricao as descricao_pai,

  case
    when c.nivel = 1 then c.id
    when c.nivel = 2 then p.id
    else gp.id
  end as grupo_id,
  case
    when c.nivel = 1 then c.codigo
    when c.nivel = 2 then p.codigo
    else gp.codigo
  end as codigo_grupo,
  case
    when c.nivel = 1 then c.descricao
    when c.nivel = 2 then p.descricao
    else gp.descricao
  end as descricao_grupo,

  case
    when c.nivel = 2 then c.id
    when c.nivel = 3 then p.id
    else null
  end as subgrupo_id,
  case
    when c.nivel = 2 then c.codigo
    when c.nivel = 3 then p.codigo
    else null
  end as codigo_subgrupo,
  case
    when c.nivel = 2 then c.descricao
    when c.nivel = 3 then p.descricao
    else null
  end as descricao_subgrupo,

  case
    when c.nivel = 1 then c.codigo
    when c.nivel = 2 then p.codigo || ' > ' || c.codigo
    else gp.codigo || ' > ' || p.codigo || ' > ' || c.codigo
  end as caminho_codigo,
  case
    when c.nivel = 1 then c.descricao
    when c.nivel = 2 then p.descricao || ' > ' || c.descricao
    else gp.descricao || ' > ' || p.descricao || ' > ' || c.descricao
  end as caminho_descricao,

  c.created_at,
  c.updated_at
from public.plano_contas c
left join public.plano_contas p on p.id = c.parent_id
left join public.plano_contas gp on gp.id = p.parent_id;

-- 2) View específica para relatórios: só contas analíticas, já trazendo grupo e subgrupo.
-- Use esta view para somar lançamentos por grupo/subgrupo/conta.
create or replace view public.vw_plano_contas_relatorio
with (security_invoker = on) as
select
  c.id as conta_id,
  c.codigo as conta_codigo,
  c.descricao as conta_descricao,
  c.natureza as conta_natureza,
  c.ordem as conta_ordem,

  s.id as subgrupo_id,
  s.codigo as subgrupo_codigo,
  s.descricao as subgrupo_descricao,
  s.ordem as subgrupo_ordem,

  g.id as grupo_id,
  g.codigo as grupo_codigo,
  g.descricao as grupo_descricao,
  g.ordem as grupo_ordem,

  g.codigo || ' > ' || s.codigo || ' > ' || c.codigo as caminho_codigo,
  g.descricao || ' > ' || s.descricao || ' > ' || c.descricao as caminho_descricao
from public.plano_contas c
join public.plano_contas s on s.id = c.parent_id
join public.plano_contas g on g.id = s.parent_id
where c.e_analitica = true
  and c.ativo = true;

-- 3) Permissões explícitas para API/Supabase.
-- As policies continuam controlando quem pode ler/alterar; o GRANT apenas libera o privilégio básico.
grant select on public.plano_contas to authenticated;
grant select on public.plano_contas_mapeamentos to authenticated;
grant insert, update, delete on public.plano_contas to authenticated;
grant insert, update, delete on public.plano_contas_mapeamentos to authenticated;
grant select on public.vw_plano_contas_hierarquia to authenticated;
grant select on public.vw_plano_contas_relatorio to authenticated;

-- 4) Garante que mapeamentos e lançamentos só apontem para contas analíticas.
-- Grupo e subgrupo são apenas para totalização, não para receber lançamento direto.
create or replace function public.validar_plano_conta_analitica(p_plano_conta_id uuid)
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
      and pc.e_analitica = true
      and pc.ativo = true
  ) then
    raise exception 'O plano_conta_id % deve apontar para uma conta analítica ativa, não para grupo/subgrupo.', p_plano_conta_id
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.trg_validar_plano_conta_analitica()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.validar_plano_conta_analitica(new.plano_conta_id);
  return new;
end;
$$;

drop trigger if exists trg_mapeamentos_conta_analitica on public.plano_contas_mapeamentos;
create trigger trg_mapeamentos_conta_analitica
before insert or update of plano_conta_id on public.plano_contas_mapeamentos
for each row execute function public.trg_validar_plano_conta_analitica();

do $$
begin
  if to_regclass('public.lancamentos_pix') is not null then
    drop trigger if exists trg_lancamentos_pix_conta_analitica on public.lancamentos_pix;
    create trigger trg_lancamentos_pix_conta_analitica
    before insert or update of plano_conta_id on public.lancamentos_pix
    for each row execute function public.trg_validar_plano_conta_analitica();
  end if;

  if to_regclass('public.dados_financeiro') is not null then
    drop trigger if exists trg_dados_financeiro_conta_analitica on public.dados_financeiro;
    create trigger trg_dados_financeiro_conta_analitica
    before insert or update of plano_conta_id on public.dados_financeiro
    for each row execute function public.trg_validar_plano_conta_analitica();
  end if;
end $$;

-- 5) Função auxiliar para encontrar uma conta pelo mapeamento cadastrado.
-- Exemplo:
-- select public.buscar_plano_conta_por_mapeamento('dados_financeiro', 'descricao', 'HORA EXTRA');
create or replace function public.buscar_plano_conta_por_mapeamento(
  p_origem text,
  p_campo_origem text,
  p_valor_origem text
)
returns uuid
language sql
stable
set search_path = public
as $$
  select m.plano_conta_id
  from public.plano_contas_mapeamentos m
  join public.plano_contas pc on pc.id = m.plano_conta_id
  where m.ativo = true
    and pc.ativo = true
    and pc.e_analitica = true
    and m.origem = p_origem
    and lower(btrim(m.campo_origem)) = lower(btrim(p_campo_origem))
    and lower(btrim(m.valor_origem)) = lower(btrim(p_valor_origem))
  order by m.prioridade asc, m.created_at asc
  limit 1;
$$;

grant execute on function public.buscar_plano_conta_por_mapeamento(text, text, text) to authenticated;
