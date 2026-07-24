-- Registra a posicao mensal dos lancamentos criados por "Multiplas Despesas".
-- Exemplo: parcela_numero = 2 e parcela_total = 3 representa a parcela 2/3.

do $$
begin
  if to_regclass('public.lancamentos_pix') is null then
    raise exception 'A tabela public.lancamentos_pix precisa existir antes desta migration.';
  end if;
end $$;

alter table public.lancamentos_pix
  add column if not exists parcela_numero integer null,
  add column if not exists parcela_total integer null;

comment on column public.lancamentos_pix.parcela_numero is
  'Numero da parcela gerada pela opcao Multiplas Despesas.';
comment on column public.lancamentos_pix.parcela_total is
  'Quantidade total de parcelas geradas pela opcao Multiplas Despesas.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lancamentos_pix_parcela_valida_check'
      and conrelid = 'public.lancamentos_pix'::regclass
  ) then
    alter table public.lancamentos_pix
      add constraint lancamentos_pix_parcela_valida_check
      check (
        (parcela_numero is null and parcela_total is null)
        or (
          parcela_numero is not null
          and parcela_total is not null
          and parcela_numero > 0
          and parcela_total > 0
          and parcela_numero <= parcela_total
        )
      );
  end if;
end $$;

create or replace view public.vw_lancamentos_pix_com_conta_analitica
with (security_invoker = on) as
select
  v.id,
  v.data_lancamento,
  v.nome,
  v.chave_pix,
  v.favorecido,
  v.descricao,
  v.valor,
  v.cnpj_id,
  v.cnpj,
  v.unidade_id,
  v.unidade,
  v.centro_de_custo_id,
  v.centro_de_custo,
  v.categoria_id,
  v.categoria,
  v.secao_custeio_id,
  v.secao_custeio,
  v.centro_custeio_id,
  v.centro_custeio,
  v.banco,
  v.forma_pagamento,
  v.status_pag,
  v.created_by,
  v.created_at,
  v.updated_at,
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
  l.rateio_item_ordem,
  l.parcela_numero,
  l.parcela_total
from public.vw_lancamentos_pix v
join public.lancamentos_pix l on l.id = v.id
left join public.unidades u on u.codigo = l.unidade_codigo
left join public.setor st on st.codigo = l.setor_codigo
left join public.plano_contas pc on pc.id = l.plano_conta_id
left join public.bancos b on b.codigo = l.banco_codigo;

grant select on public.vw_lancamentos_pix_com_conta_analitica to authenticated;

-- Mantem a parcela ao editar ou recriar os itens de um lote de rateios.
create or replace function public.atualizar_lancamento_com_rateios(
  p_lancamento_id uuid,
  p_dados jsonb,
  p_valor_total numeric,
  p_rateios jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_original public.lancamentos_pix%rowtype;
  v_lote_id uuid;
  v_rateio jsonb;
  v_soma numeric;
  v_valor numeric;
  v_ordem integer := 0;
begin
  if jsonb_typeof(p_rateios) <> 'array' or jsonb_array_length(p_rateios) = 0 then
    raise exception 'Informe ao menos uma linha de rateio.';
  end if;

  if coalesce(p_valor_total, 0) <= 0 then
    raise exception 'O valor geral precisa ser maior que zero.';
  end if;

  select *
    into v_original
  from public.lancamentos_pix
  where id = p_lancamento_id
  for update;

  if not found then
    raise exception 'Lancamento nao encontrado ou sem permissao para edicao.';
  end if;

  select coalesce(sum((item->>'valor')::numeric), 0)
    into v_soma
  from jsonb_array_elements(p_rateios) as item;

  if abs(v_soma - p_valor_total) > 0.009 then
    raise exception 'A soma dos rateios (%) difere do valor geral (%).', v_soma, p_valor_total;
  end if;

  v_lote_id := coalesce(v_original.rateio_lote_id, gen_random_uuid());

  if v_original.rateio_lote_id is not null then
    perform 1
    from public.lancamentos_pix
    where rateio_lote_id = v_original.rateio_lote_id
    for update;

    delete from public.lancamentos_pix
    where rateio_lote_id = v_original.rateio_lote_id
      and id <> p_lancamento_id;
  end if;

  for v_rateio in
    select value from jsonb_array_elements(p_rateios)
  loop
    v_ordem := v_ordem + 1;
    v_valor := (v_rateio->>'valor')::numeric;

    if v_valor <= 0
       or nullif(btrim(coalesce(v_rateio->>'unidade_id', '')), '') is null
       or nullif(btrim(coalesce(v_rateio->>'centro_de_custo_id', '')), '') is null
       or nullif(btrim(coalesce(v_rateio->>'plano_conta_id', '')), '') is null then
      raise exception 'A linha % do rateio esta incompleta.', v_ordem;
    end if;

    if v_ordem = 1 then
      update public.lancamentos_pix
      set
        data_lancamento = (p_dados->>'data_lancamento')::date,
        nome = btrim(p_dados->>'nome'),
        chave_pix = nullif(btrim(coalesce(p_dados->>'chave_pix', '')), ''),
        favorecido = btrim(p_dados->>'favorecido'),
        descricao = nullif(btrim(coalesce(p_dados->>'descricao', '')), ''),
        plano_conta_id = (v_rateio->>'plano_conta_id')::uuid,
        valor = v_valor,
        unidade_id = null,
        unidade_codigo = v_rateio->>'unidade_id',
        centro_de_custo_id = null,
        setor_codigo = v_rateio->>'centro_de_custo_id',
        banco_codigo = nullif(btrim(coalesce(p_dados->>'banco_codigo', '')), ''),
        banco = nullif(btrim(coalesce(p_dados->>'banco', '')), ''),
        status_pag = coalesce(nullif(btrim(coalesce(p_dados->>'status_pag', '')), ''), 'A PAGAR'),
        rateio_lote_id = v_lote_id,
        rateio_item_ordem = v_ordem
      where id = p_lancamento_id;
    else
      insert into public.lancamentos_pix (
        data_lancamento,
        nome,
        chave_pix,
        favorecido,
        descricao,
        plano_conta_id,
        valor,
        cnpj_id,
        unidade_id,
        unidade_codigo,
        centro_de_custo_id,
        setor_codigo,
        categoria_id,
        secao_custeio_id,
        centro_custeio_id,
        banco_codigo,
        banco,
        status_pag,
        rateio_lote_id,
        rateio_item_ordem,
        parcela_numero,
        parcela_total
      ) values (
        (p_dados->>'data_lancamento')::date,
        btrim(p_dados->>'nome'),
        nullif(btrim(coalesce(p_dados->>'chave_pix', '')), ''),
        btrim(p_dados->>'favorecido'),
        nullif(btrim(coalesce(p_dados->>'descricao', '')), ''),
        (v_rateio->>'plano_conta_id')::uuid,
        v_valor,
        v_original.cnpj_id,
        null,
        v_rateio->>'unidade_id',
        null,
        v_rateio->>'centro_de_custo_id',
        v_original.categoria_id,
        v_original.secao_custeio_id,
        v_original.centro_custeio_id,
        nullif(btrim(coalesce(p_dados->>'banco_codigo', '')), ''),
        nullif(btrim(coalesce(p_dados->>'banco', '')), ''),
        coalesce(nullif(btrim(coalesce(p_dados->>'status_pag', '')), ''), 'A PAGAR'),
        v_lote_id,
        v_ordem,
        v_original.parcela_numero,
        v_original.parcela_total
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.atualizar_lancamento_com_rateios(uuid, jsonb, numeric, jsonb)
  to authenticated;
