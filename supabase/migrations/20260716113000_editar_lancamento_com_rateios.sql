-- Atualiza um lancamento simples ou um lote de rateios em uma unica transacao.

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
        rateio_item_ordem
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
        v_ordem
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.atualizar_lancamento_com_rateios(uuid, jsonb, numeric, jsonb)
  to authenticated;
