-- Beneficios importados por CPF.
-- Cada importacao escolhe a conta analitica que recebera todos os itens do arquivo.

do $$
begin
  if to_regclass('public.registros_dados') is null then
    raise exception 'A tabela public.registros_dados precisa existir antes desta migration.';
  end if;

  if to_regclass('public.plano_contas') is null then
    raise exception 'A tabela public.plano_contas precisa existir antes desta migration.';
  end if;

  if to_regclass('public.unidades') is null then
    raise exception 'A tabela public.unidades precisa existir antes desta migration.';
  end if;

  if to_regclass('public.setor') is null then
    raise exception 'A tabela public.setor precisa existir antes desta migration.';
  end if;
end $$;

create or replace function public.validar_beneficio_plano_conta(p_plano_conta_id uuid)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if p_plano_conta_id is null then
    raise exception 'O beneficio precisa estar vinculado a uma conta analitica.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.plano_contas pc
    where pc.id = p_plano_conta_id
      and pc.ativo = true
      and pc.e_analitica = true
      and pc.natureza in ('Custo', 'Despesa')
  ) then
    raise exception 'O plano_conta_id % deve apontar para uma conta analitica ativa de Custo ou Despesa.', p_plano_conta_id
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.trg_validar_beneficio_plano_conta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.validar_beneficio_plano_conta(new.plano_conta_id);
  return new;
end;
$$;

create table if not exists public.beneficios_combustivel (
  id uuid primary key default gen_random_uuid(),
  data_beneficio date not null,
  cpf text not null,
  nome text not null,
  unidade_codigo text null references public.unidades(codigo) on update cascade on delete restrict,
  setor_codigo text null references public.setor(codigo) on update cascade on delete restrict,
  plano_conta_id uuid not null references public.plano_contas(id) on update cascade on delete restrict,
  valor numeric(14,2) not null,
  arquivo_nome text null,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beneficios_combustivel_cpf_not_blank check (btrim(cpf) <> ''),
  constraint beneficios_combustivel_nome_not_blank check (btrim(nome) <> ''),
  constraint beneficios_combustivel_valor_check check (valor >= 0)
);

create table if not exists public.beneficios_agregamento (
  id uuid primary key default gen_random_uuid(),
  data_beneficio date not null,
  cpf text not null,
  nome text not null,
  unidade_codigo text null references public.unidades(codigo) on update cascade on delete restrict,
  setor_codigo text null references public.setor(codigo) on update cascade on delete restrict,
  plano_conta_id uuid not null references public.plano_contas(id) on update cascade on delete restrict,
  valor numeric(14,2) not null,
  arquivo_nome text null,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beneficios_agregamento_cpf_not_blank check (btrim(cpf) <> ''),
  constraint beneficios_agregamento_nome_not_blank check (btrim(nome) <> ''),
  constraint beneficios_agregamento_valor_check check (valor >= 0)
);

comment on table public.beneficios_combustivel is
  'Beneficios de combustivel importados por CPF para composicao da DRE.';
comment on table public.beneficios_agregamento is
  'Beneficios de agregamento importados por CPF para composicao da DRE.';
comment on column public.beneficios_combustivel.plano_conta_id is
  'Conta analitica escolhida na importacao. Esta conta define a linha da DRE.';
comment on column public.beneficios_agregamento.plano_conta_id is
  'Conta analitica escolhida na importacao. Esta conta define a linha da DRE.';

create index if not exists idx_beneficios_combustivel_data
  on public.beneficios_combustivel(data_beneficio desc);
create index if not exists idx_beneficios_combustivel_cpf
  on public.beneficios_combustivel(cpf);
create index if not exists idx_beneficios_combustivel_unidade
  on public.beneficios_combustivel(unidade_codigo);
create index if not exists idx_beneficios_combustivel_setor
  on public.beneficios_combustivel(setor_codigo);
create index if not exists idx_beneficios_combustivel_conta
  on public.beneficios_combustivel(plano_conta_id);

create index if not exists idx_beneficios_agregamento_data
  on public.beneficios_agregamento(data_beneficio desc);
create index if not exists idx_beneficios_agregamento_cpf
  on public.beneficios_agregamento(cpf);
create index if not exists idx_beneficios_agregamento_unidade
  on public.beneficios_agregamento(unidade_codigo);
create index if not exists idx_beneficios_agregamento_setor
  on public.beneficios_agregamento(setor_codigo);
create index if not exists idx_beneficios_agregamento_conta
  on public.beneficios_agregamento(plano_conta_id);

drop trigger if exists trg_beneficios_combustivel_updated_at on public.beneficios_combustivel;
create trigger trg_beneficios_combustivel_updated_at
before update on public.beneficios_combustivel
for each row execute function public.set_updated_at();

drop trigger if exists trg_beneficios_agregamento_updated_at on public.beneficios_agregamento;
create trigger trg_beneficios_agregamento_updated_at
before update on public.beneficios_agregamento
for each row execute function public.set_updated_at();

drop trigger if exists trg_beneficios_combustivel_plano_conta on public.beneficios_combustivel;
create trigger trg_beneficios_combustivel_plano_conta
before insert or update of plano_conta_id on public.beneficios_combustivel
for each row execute function public.trg_validar_beneficio_plano_conta();

drop trigger if exists trg_beneficios_agregamento_plano_conta on public.beneficios_agregamento;
create trigger trg_beneficios_agregamento_plano_conta
before insert or update of plano_conta_id on public.beneficios_agregamento
for each row execute function public.trg_validar_beneficio_plano_conta();

alter table public.beneficios_combustivel enable row level security;
alter table public.beneficios_agregamento enable row level security;

drop policy if exists "approved users can read beneficios_combustivel" on public.beneficios_combustivel;
create policy "approved users can read beneficios_combustivel"
on public.beneficios_combustivel
for select
to authenticated
using (public.is_approved_profile());

drop policy if exists "approved users can insert beneficios_combustivel" on public.beneficios_combustivel;
create policy "approved users can insert beneficios_combustivel"
on public.beneficios_combustivel
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_approved_profile()
);

drop policy if exists "admin and rh can update beneficios_combustivel" on public.beneficios_combustivel;
create policy "admin and rh can update beneficios_combustivel"
on public.beneficios_combustivel
for update
to authenticated
using (public.has_profile_role(array['admin', 'rh']))
with check (public.has_profile_role(array['admin', 'rh']));

drop policy if exists "admin and rh can delete beneficios_combustivel" on public.beneficios_combustivel;
create policy "admin and rh can delete beneficios_combustivel"
on public.beneficios_combustivel
for delete
to authenticated
using (public.has_profile_role(array['admin', 'rh']));

drop policy if exists "approved users can read beneficios_agregamento" on public.beneficios_agregamento;
create policy "approved users can read beneficios_agregamento"
on public.beneficios_agregamento
for select
to authenticated
using (public.is_approved_profile());

drop policy if exists "approved users can insert beneficios_agregamento" on public.beneficios_agregamento;
create policy "approved users can insert beneficios_agregamento"
on public.beneficios_agregamento
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_approved_profile()
);

drop policy if exists "admin and rh can update beneficios_agregamento" on public.beneficios_agregamento;
create policy "admin and rh can update beneficios_agregamento"
on public.beneficios_agregamento
for update
to authenticated
using (public.has_profile_role(array['admin', 'rh']))
with check (public.has_profile_role(array['admin', 'rh']));

drop policy if exists "admin and rh can delete beneficios_agregamento" on public.beneficios_agregamento;
create policy "admin and rh can delete beneficios_agregamento"
on public.beneficios_agregamento
for delete
to authenticated
using (public.has_profile_role(array['admin', 'rh']));

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
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta
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
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta
from public.beneficios_agregamento b
left join public.unidades u
  on u.codigo = b.unidade_codigo
left join public.setor s
  on s.codigo = b.setor_codigo
join public.vw_plano_contas_relatorio pc
  on pc.conta_id = b.plano_conta_id;

create or replace view public.vw_movimentos_dre
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

  union all

  select
    'beneficios:' || b.tipo || ':' || b.id::text as id,
    b.id::text as origem_id,
    b.data_beneficio::date as data_movimento,
    b.tipo_label || ' - ' || coalesce(nullif(btrim(b.nome), ''), 'Beneficio') as descricao,
    -abs(coalesce(b.valor, 0)::numeric) as valor,
    b.plano_conta_id,
    b.unidade_codigo,
    b.unidade_nome,
    b.setor_codigo,
    b.setor_nome,
    'beneficios_' || b.tipo as origem,
    b.conta_codigo,
    b.conta_descricao,
    b.conta_natureza,
    b.subgrupo_codigo,
    b.subgrupo_descricao,
    b.grupo_codigo,
    b.grupo_descricao
  from public.vw_beneficios_plano_contas b
  where coalesce(b.valor, 0) <> 0
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

create or replace view public.vw_movimentos_dre_pendencias
with (security_invoker = on) as
select *
from public.vw_movimentos_dre
where dre_linha_id is null;

grant execute on function public.validar_beneficio_plano_conta(uuid) to authenticated;
grant select, insert, update, delete on public.beneficios_combustivel to authenticated;
grant select, insert, update, delete on public.beneficios_agregamento to authenticated;
grant select on public.vw_beneficios_plano_contas to authenticated;
grant select on public.vw_movimentos_dre to authenticated;
grant select on public.vw_movimentos_dre_pendencias to authenticated;
