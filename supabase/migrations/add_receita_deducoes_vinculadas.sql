-- Permite vincular deducoes/impostos a uma receita principal.
-- A deducao continua sendo gravada em public.receitas com natureza Deducao,
-- assim a DRE existente segue tratando o valor como negativo.

alter table public.receitas
  add column if not exists receita_pai_id uuid null;

do $$
begin
  alter table public.receitas
    add constraint receitas_receita_pai_id_fkey
    foreign key (receita_pai_id)
    references public.receitas(id)
    on update cascade
    on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.receitas
    add constraint receitas_receita_pai_diferente_check
    check (receita_pai_id is null or receita_pai_id <> id);
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_receitas_receita_pai_id
  on public.receitas(receita_pai_id)
  where receita_pai_id is not null;

comment on column public.receitas.receita_pai_id is
  'Quando preenchido, indica que a linha e uma deducao/imposto vinculado a uma receita principal.';

create or replace view public.vw_receitas_plano_contas
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
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta,
  r.receita_pai_id
from public.receitas r
join public.vw_plano_contas_relatorio pc
  on pc.conta_id = r.plano_conta_id
left join public.unidades u
  on u.codigo = r.unidade_codigo
left join public.setor st
  on st.codigo = r.setor_codigo;

grant select on public.vw_receitas_plano_contas to authenticated;
