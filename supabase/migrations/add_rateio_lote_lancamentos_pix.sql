-- Identifica itens que pertencem ao mesmo boleto/rateio.
-- A DRE continua usando apenas os lancamentos analiticos; o lote serve para agrupamento visual.

do $$
begin
  if to_regclass('public.lancamentos_pix') is null then
    raise exception 'A tabela public.lancamentos_pix precisa existir antes desta migration.';
  end if;
end $$;

alter table public.lancamentos_pix
  add column if not exists rateio_lote_id uuid null,
  add column if not exists rateio_item_ordem integer null;

comment on column public.lancamentos_pix.rateio_lote_id is
  'Identificador comum dos itens gerados por um lancamento com multiplos rateios.';
comment on column public.lancamentos_pix.rateio_item_ordem is
  'Ordem visual do item dentro do lote de multiplos rateios.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lancamentos_pix_rateio_item_ordem_check'
      and conrelid = 'public.lancamentos_pix'::regclass
  ) then
    alter table public.lancamentos_pix
      add constraint lancamentos_pix_rateio_item_ordem_check
      check (rateio_item_ordem is null or rateio_item_ordem > 0);
  end if;
end $$;

create index if not exists idx_lancamentos_pix_rateio_lote_id
  on public.lancamentos_pix(rateio_lote_id)
  where rateio_lote_id is not null;

create index if not exists idx_lancamentos_pix_rateio_lote_ordem
  on public.lancamentos_pix(rateio_lote_id, rateio_item_ordem, created_at)
  where rateio_lote_id is not null;

create or replace view public.vw_lancamentos_pix_com_conta_analitica
with (security_invoker = on) as
select
  v.*,
  l.plano_conta_id,
  l.unidade_codigo,
  u.unidade as unidade_cadastro,
  l.setor_codigo,
  st.setor as setor_nome,
  pc.codigo as conta_analitica_codigo,
  pc.descricao as conta_analitica_descricao,
  case
    when pc.id is null then null
    else pc.codigo || ' - ' || pc.descricao
  end as conta_analitica,
  l.banco_codigo,
  b.banco as banco_cadastro,
  l.rateio_lote_id,
  l.rateio_item_ordem
from public.vw_lancamentos_pix v
join public.lancamentos_pix l on l.id = v.id
left join public.unidades u on u.codigo = l.unidade_codigo
left join public.setor st on st.codigo = l.setor_codigo
left join public.plano_contas pc on pc.id = l.plano_conta_id
left join public.bancos b on b.codigo = l.banco_codigo;

grant select on public.vw_lancamentos_pix_com_conta_analitica to authenticated;
