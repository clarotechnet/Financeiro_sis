-- Permite transformar um lancamento simples editado em uma serie mensal.
-- A atualizacao da primeira ocorrencia e a criacao das demais sao atomicas.

create or replace function public.atualizar_lancamento_com_multiplas_despesas(
  p_lancamento_id uuid,
  p_dados jsonb,
  p_valor_total numeric,
  p_rateios jsonb,
  p_quantidade integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_original public.lancamentos_pix%rowtype;
  v_origem public.lancamentos_pix%rowtype;
  v_item public.lancamentos_pix%rowtype;
  v_lote_origem uuid;
  v_novo_lote uuid;
  v_data_base date;
  v_inicio_mes date;
  v_data_futura date;
  v_ultimo_dia integer;
  v_indice integer;
  v_tem_rateio boolean;
begin
  if p_quantidade < 2 or p_quantidade > 60 then
    raise exception 'A quantidade de lancamentos deve estar entre 2 e 60.';
  end if;

  if coalesce(p_valor_total, 0) <= 0 then
    raise exception 'O valor do lancamento precisa ser maior que zero.';
  end if;

  select *
    into v_original
  from public.lancamentos_pix
  where id = p_lancamento_id
  for update;

  if not found then
    raise exception 'Lancamento nao encontrado ou sem permissao para edicao.';
  end if;

  if coalesce(v_original.parcela_total, 1) > 1 then
    raise exception 'Este lancamento ja pertence a uma serie de multiplas despesas.';
  end if;

  v_data_base := (p_dados->>'data_lancamento')::date;
  v_tem_rateio := jsonb_typeof(coalesce(p_rateios, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(p_rateios, '[]'::jsonb)) > 0;

  if v_original.rateio_lote_id is not null and not v_tem_rateio then
    raise exception 'Informe os itens do rateio para editar este lote.';
  end if;

  if v_tem_rateio then
    perform public.atualizar_lancamento_com_rateios(
      p_lancamento_id,
      p_dados,
      p_valor_total,
      p_rateios
    );

    select rateio_lote_id
      into v_lote_origem
    from public.lancamentos_pix
    where id = p_lancamento_id;

    update public.lancamentos_pix
    set
      parcela_numero = 1,
      parcela_total = p_quantidade
    where rateio_lote_id = v_lote_origem;
  else
    update public.lancamentos_pix
    set
      data_lancamento = v_data_base,
      nome = btrim(p_dados->>'nome'),
      chave_pix = nullif(btrim(coalesce(p_dados->>'chave_pix', '')), ''),
      favorecido = btrim(p_dados->>'favorecido'),
      descricao = nullif(btrim(coalesce(p_dados->>'descricao', '')), ''),
      plano_conta_id = (p_dados->>'plano_conta_id')::uuid,
      valor = p_valor_total,
      unidade_id = null,
      unidade_codigo = p_dados->>'unidade_codigo',
      centro_de_custo_id = null,
      setor_codigo = p_dados->>'setor_codigo',
      banco_codigo = nullif(btrim(coalesce(p_dados->>'banco_codigo', '')), ''),
      banco = nullif(btrim(coalesce(p_dados->>'banco', '')), ''),
      status_pag = coalesce(
        nullif(btrim(coalesce(p_dados->>'status_pag', '')), ''),
        'A PAGAR'
      ),
      parcela_numero = 1,
      parcela_total = p_quantidade
    where id = p_lancamento_id;
  end if;

  for v_indice in 1..(p_quantidade - 1)
  loop
    v_inicio_mes := (
      date_trunc('month', v_data_base)::date
      + make_interval(months => v_indice)
    )::date;
    v_ultimo_dia := extract(
      day from (v_inicio_mes + interval '1 month' - interval '1 day')
    )::integer;
    v_data_futura := v_inicio_mes
      + (least(extract(day from v_data_base)::integer, v_ultimo_dia) - 1);

    if v_tem_rateio then
      v_novo_lote := gen_random_uuid();

      for v_item in
        select *
        from public.lancamentos_pix
        where rateio_lote_id = v_lote_origem
        order by rateio_item_ordem, created_at, id
      loop
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
          v_data_futura,
          v_item.nome,
          v_item.chave_pix,
          v_item.favorecido,
          v_item.descricao,
          v_item.plano_conta_id,
          v_item.valor,
          v_item.cnpj_id,
          null,
          v_item.unidade_codigo,
          null,
          v_item.setor_codigo,
          v_item.categoria_id,
          v_item.secao_custeio_id,
          v_item.centro_custeio_id,
          v_item.banco_codigo,
          v_item.banco,
          v_item.status_pag,
          v_novo_lote,
          v_item.rateio_item_ordem,
          v_indice + 1,
          p_quantidade
        );
      end loop;
    else
      select *
        into v_origem
      from public.lancamentos_pix
      where id = p_lancamento_id;

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
        v_data_futura,
        v_origem.nome,
        v_origem.chave_pix,
        v_origem.favorecido,
        v_origem.descricao,
        v_origem.plano_conta_id,
        v_origem.valor,
        v_origem.cnpj_id,
        null,
        v_origem.unidade_codigo,
        null,
        v_origem.setor_codigo,
        v_origem.categoria_id,
        v_origem.secao_custeio_id,
        v_origem.centro_custeio_id,
        v_origem.banco_codigo,
        v_origem.banco,
        v_origem.status_pag,
        null,
        null,
        v_indice + 1,
        p_quantidade
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.atualizar_lancamento_com_multiplas_despesas(
  uuid,
  jsonb,
  numeric,
  jsonb,
  integer
) from public;

revoke all on function public.atualizar_lancamento_com_multiplas_despesas(
  uuid,
  jsonb,
  numeric,
  jsonb,
  integer
) from anon;

grant execute on function public.atualizar_lancamento_com_multiplas_despesas(
  uuid,
  jsonb,
  numeric,
  jsonb,
  integer
) to authenticated;
