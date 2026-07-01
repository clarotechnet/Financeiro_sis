-- Camada formal de DRE sobre o plano de contas atual.
-- Nao altera lancamentos existentes: cria layout, de-para, view unificada e RPC.

do $$
begin
  if to_regclass('public.plano_contas') is null then
    raise exception 'A tabela public.plano_contas precisa existir antes desta migration.';
  end if;

  if to_regclass('public.lancamentos_pix') is null then
    raise exception 'A tabela public.lancamentos_pix precisa existir antes desta migration.';
  end if;

  if to_regclass('public.receitas') is null then
    raise exception 'A tabela public.receitas precisa existir antes desta migration.';
  end if;

  if to_regclass('public.dados_financeiro') is null then
    raise exception 'A tabela public.dados_financeiro precisa existir antes desta migration.';
  end if;
end $$;

create table if not exists public.dre_linhas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text not null,
  ordem integer not null default 0,
  nivel smallint not null default 1,
  tipo text not null,
  sinal smallint not null default 1,
  ativo boolean not null default true,
  exibir_pdf boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint dre_linhas_tipo_check check (tipo in ('grupo', 'contas', 'subtotal', 'resultado')),
  constraint dre_linhas_sinal_check check (sinal in (-1, 1)),
  constraint dre_linhas_nivel_check check (nivel between 1 and 5)
);

comment on table public.dre_linhas is
  'Layout da DRE. Nao armazena valores financeiros; apenas estrutura, ordem e tipo das linhas.';

create table if not exists public.dre_linha_contas (
  id uuid primary key default gen_random_uuid(),
  dre_linha_id uuid not null references public.dre_linhas(id) on update cascade on delete cascade,
  plano_conta_id uuid not null references public.plano_contas(id) on update cascade on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint dre_linha_contas_unique unique (dre_linha_id, plano_conta_id)
);

comment on table public.dre_linha_contas is
  'De-para entre contas analiticas do plano de contas e linhas da DRE.';

create unique index if not exists idx_dre_linha_contas_plano_conta_unique
  on public.dre_linha_contas(plano_conta_id);

create index if not exists idx_dre_linha_contas_dre_linha_id
  on public.dre_linha_contas(dre_linha_id);

create index if not exists idx_dre_linhas_ordem
  on public.dre_linhas(ordem);

create index if not exists idx_lancamentos_pix_dre_data
  on public.lancamentos_pix(data_lancamento);

create index if not exists idx_dados_financeiro_dre_data
  on public.dados_financeiro(data);

drop trigger if exists trg_dre_linha_contas_conta_analitica on public.dre_linha_contas;
create trigger trg_dre_linha_contas_conta_analitica
before insert or update of plano_conta_id on public.dre_linha_contas
for each row execute function public.trg_validar_plano_conta_analitica();

drop trigger if exists trg_dre_linhas_updated_at on public.dre_linhas;
create trigger trg_dre_linhas_updated_at
before update on public.dre_linhas
for each row execute function public.set_updated_at();

alter table public.dre_linhas enable row level security;
alter table public.dre_linha_contas enable row level security;

drop policy if exists "approved users can read dre_linhas" on public.dre_linhas;
create policy "approved users can read dre_linhas"
on public.dre_linhas
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

drop policy if exists "admins can manage dre_linhas" on public.dre_linhas;
create policy "admins can manage dre_linhas"
on public.dre_linhas
for all
to authenticated
using (public.has_profile_role(array['admin']))
with check (public.has_profile_role(array['admin']));

drop policy if exists "approved users can read dre_linha_contas" on public.dre_linha_contas;
create policy "approved users can read dre_linha_contas"
on public.dre_linha_contas
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

drop policy if exists "admins can manage dre_linha_contas" on public.dre_linha_contas;
create policy "admins can manage dre_linha_contas"
on public.dre_linha_contas
for all
to authenticated
using (public.has_profile_role(array['admin']))
with check (public.has_profile_role(array['admin']));

grant select on public.dre_linhas to authenticated;
grant select on public.dre_linha_contas to authenticated;
grant insert, update, delete on public.dre_linhas to authenticated;
grant insert, update, delete on public.dre_linha_contas to authenticated;

insert into public.dre_linhas (codigo, descricao, ordem, nivel, tipo, sinal, ativo, exibir_pdf)
values
  ('01', 'RECEITAS', 10, 1, 'grupo', 1, true, true),
  ('01.01', 'Receita Bruta', 20, 2, 'contas', 1, true, true),
  ('01.02', 'Deduções', 30, 2, 'contas', 1, true, true),
  ('01.99', 'Receita Líquida', 40, 2, 'subtotal', 1, true, true),
  ('02', 'CUSTOS', 50, 1, 'grupo', 1, true, true),
  ('02.01', 'Custos Diretos', 60, 2, 'contas', 1, true, true),
  ('02.99', 'Lucro Bruto', 70, 2, 'subtotal', 1, true, true),
  ('03', 'DESPESAS OPERACIONAIS', 80, 1, 'grupo', 1, true, true),
  ('03.01', 'Despesas Administrativas', 90, 2, 'contas', 1, true, true),
  ('03.02', 'Despesas com Pessoal', 100, 2, 'contas', 1, true, true),
  ('03.99', 'EBITDA', 110, 2, 'subtotal', 1, true, true),
  ('04', 'RESULTADO FINANCEIRO', 120, 1, 'grupo', 1, true, true),
  ('04.01', 'Receitas Financeiras', 130, 2, 'contas', 1, true, true),
  ('04.02', 'Despesas Financeiras', 140, 2, 'contas', 1, true, true),
  ('04.99', 'Resultado Líquido', 150, 2, 'resultado', 1, true, true)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  ordem = excluded.ordem,
  nivel = excluded.nivel,
  tipo = excluded.tipo,
  sinal = excluded.sinal,
  ativo = excluded.ativo,
  exibir_pdf = excluded.exibir_pdf;

-- Mapeamento inicial conservador. Contas ja remapeadas manualmente nao sao sobrescritas.
insert into public.dre_linha_contas (dre_linha_id, plano_conta_id)
select
  dl.id,
  pc.conta_id
from public.vw_plano_contas_relatorio pc
join public.dre_linhas dl
  on dl.codigo = case
    when pc.conta_codigo like '01-03-%' or pc.conta_natureza = 'Dedução' then '01.02'
    when pc.conta_codigo like '01-%' and pc.conta_natureza = 'Receita' then '01.01'
    when pc.conta_codigo like '02-%' then '02.01'
    when pc.conta_codigo like '03-01-%'
      or pc.conta_codigo like '03-02-%'
      or pc.conta_codigo like '03-03-%'
      or pc.conta_codigo like '03-04-%' then '03.02'
    when pc.conta_codigo like '03-%' then '03.01'
    when pc.conta_codigo like '04-02-%' then '04.01'
    when pc.conta_codigo like '04-01-%' then '04.02'
    else null
  end
where pc.conta_id is not null
on conflict (plano_conta_id) do nothing;

drop view if exists public.vw_movimentos_dre_pendencias;
drop view if exists public.vw_movimentos_dre;

create view public.vw_movimentos_dre
with (security_invoker = on) as
with movimentos as (
  select
    'receitas:' || r.id::text as id,
    r.id::text as origem_id,
    r.data_recebimento::date as data_movimento,
    coalesce(nullif(btrim(r.descricao), ''), nullif(btrim(r.cliente), ''), nullif(btrim(r.nome), ''), 'Receita') as descricao,
    case
      when r.conta_natureza = 'Dedução' then -abs(coalesce(r.valor, 0)::numeric)
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
    'lancamentos_pix:' || p.id::text as id,
    p.id::text as origem_id,
    p.data_lancamento::date as data_movimento,
    coalesce(nullif(btrim(p.descricao), ''), nullif(btrim(p.favorecido), ''), 'Lançamento PIX') as descricao,
    -abs(coalesce(p.valor, 0)::numeric) as valor,
    p.plano_conta_id,
    p.unidade_codigo,
    p.unidade_cadastro as unidade_nome,
    p.setor_codigo,
    p.setor_nome,
    'lancamentos_pix'::text as origem,
    pc.conta_codigo,
    pc.conta_descricao,
    pc.conta_natureza,
    pc.subgrupo_codigo,
    pc.subgrupo_descricao,
    pc.grupo_codigo,
    pc.grupo_descricao
  from public.vw_lancamentos_pix_com_conta_analitica p
  left join public.vw_plano_contas_relatorio pc
    on pc.conta_id = p.plano_conta_id
  where coalesce(p.valor, 0) <> 0
    and (p.status_pag is null or p.status_pag not ilike 'cancel%')

  union all

  select
    'dados_financeiro:' || f.dados_financeiro_id::text || ':' || f.campo_folha as id,
    f.dados_financeiro_id::text as origem_id,
    f.data::date as data_movimento,
    coalesce(nullif(btrim(f.label_folha), ''), f.campo_folha) || ' - ' || coalesce(nullif(btrim(f.nome), ''), nullif(btrim(f.nome_registro), ''), 'Folha') as descricao,
    -abs(coalesce(f.valor, 0)::numeric) as valor,
    f.plano_conta_id,
    rd.unidade_codigo,
    u.unidade as unidade_nome,
    rd.setor_codigo,
    st.setor as setor_nome,
    'dados_financeiro'::text as origem,
    f.conta_codigo,
    f.conta_descricao,
    f.conta_natureza,
    f.subgrupo_codigo,
    f.subgrupo_descricao,
    f.grupo_codigo,
    f.grupo_descricao
  from public.vw_dados_financeiro_plano_contas f
  left join public.registros_dados rd
    on rd.id = f.registro_id
  left join public.unidades u
    on u.codigo = rd.unidade_codigo
  left join public.setor st
    on st.codigo = rd.setor_codigo
  where coalesce(f.valor, 0) <> 0
    and f.campo_folha not in ('total_descontos', 'total_proventos')
)
select
  m.*,
  dl.id as dre_linha_id,
  dl.codigo as dre_linha_codigo,
  dl.descricao as dre_linha_descricao,
  dl.ordem as dre_linha_ordem
from movimentos m
left join public.dre_linha_contas dlc
  on dlc.plano_conta_id = m.plano_conta_id
left join public.dre_linhas dl
  on dl.id = dlc.dre_linha_id
 and dl.ativo = true;

create view public.vw_movimentos_dre_pendencias
with (security_invoker = on) as
select *
from public.vw_movimentos_dre
where dre_linha_id is null;

grant select on public.vw_movimentos_dre to authenticated;
grant select on public.vw_movimentos_dre_pendencias to authenticated;

create or replace function public.gerar_dre(
  p_data_inicio date default null,
  p_data_fim date default null,
  p_unidade_codigo text default null,
  p_setor_codigo text default null
)
returns table (
  dre_linha_id uuid,
  codigo text,
  descricao text,
  ordem integer,
  nivel smallint,
  tipo text,
  sinal smallint,
  total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    dl.id as dre_linha_id,
    dl.codigo,
    dl.descricao,
    dl.ordem,
    dl.nivel,
    dl.tipo,
    dl.sinal,
    coalesce(sum(m.valor), 0)::numeric as total
  from public.dre_linhas dl
  left join public.vw_movimentos_dre m
    on m.dre_linha_id = dl.id
   and (p_data_inicio is null or m.data_movimento >= p_data_inicio)
   and (p_data_fim is null or m.data_movimento <= p_data_fim)
   and (p_unidade_codigo is null or m.unidade_codigo = p_unidade_codigo)
   and (p_setor_codigo is null or m.setor_codigo = p_setor_codigo)
  where dl.ativo = true
    and dl.exibir_pdf = true
  group by
    dl.id,
    dl.codigo,
    dl.descricao,
    dl.ordem,
    dl.nivel,
    dl.tipo,
    dl.sinal
  order by dl.ordem, dl.codigo;
$$;

grant execute on function public.gerar_dre(date, date, text, text) to authenticated;
