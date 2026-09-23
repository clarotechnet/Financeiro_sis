-- Only the allocated rows are financial entries; there is no extra header amount.
alter table public.receitas
  add column if not exists rateio_lote_id uuid,
  add column if not exists rateio_cliente_geral text,
  add column if not exists rateio_item_ordem integer,
  add column if not exists parcela_numero integer,
  add column if not exists parcela_total integer;

create index if not exists idx_receitas_rateio_lote on public.receitas(rateio_lote_id)
  where rateio_lote_id is not null;

create or replace view public.vw_receitas_plano_contas
with (security_invoker = on) as
select r.id, r.data_recebimento, r.nome, r.cliente, r.descricao, r.valor,
  r.plano_conta_id, r.unidade_codigo, u.unidade as unidade_nome,
  r.setor_codigo, st.setor as setor_nome, r.banco, r.forma_recebimento,
  r.documento, r.created_by, r.created_at, r.updated_at,
  pc.conta_codigo, pc.conta_descricao, pc.conta_natureza,
  pc.subgrupo_id, pc.subgrupo_codigo, pc.subgrupo_descricao,
  pc.grupo_id, pc.grupo_codigo, pc.grupo_descricao,
  pc.caminho_codigo, pc.caminho_descricao,
  pc.conta_codigo || ' - ' || pc.conta_descricao as conta_analitica,
  pc.grupo_codigo || ' - ' || pc.grupo_descricao as grupo_conta,
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta,
  r.receita_pai_id, r.rateio_lote_id, r.rateio_cliente_geral,
  r.rateio_item_ordem, r.parcela_numero, r.parcela_total
from public.receitas r
join public.vw_plano_contas_relatorio pc on pc.conta_id = r.plano_conta_id
left join public.unidades u on u.codigo = r.unidade_codigo
left join public.setor st on st.codigo = r.setor_codigo;

create or replace function public.salvar_receita_com_rateios(
  p_dados jsonb,
  p_receita_id uuid default null,
  p_editar_lote boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_target public.receitas%rowtype;
  v_row public.receitas%rowtype;
  v_ids uuid[] := array[]::uuid[];
  v_kept uuid[] := array[]::uuid[];
  v_month_ids uuid[];
  v_capacities numeric[];
  v_items jsonb := coalesce(p_dados->'rateios', '[]'::jsonb);
  v_deducoes jsonb := coalesce(p_dados->'deducoes', '[]'::jsonb);
  v_item jsonb;
  v_tax jsonb;
  v_split boolean;
  v_total numeric := (p_dados->>'valor')::numeric;
  v_tax_total numeric;
  v_quantity integer := coalesce((p_dados->>'quantidade_receitas')::integer, 1);
  v_start date := (p_dados->>'data_recebimento')::date;
  v_month date;
  v_date date;
  v_group uuid;
  v_id uuid;
  v_item_id uuid;
  v_value numeric;
  v_capacity_total numeric;
  v_cumulative numeric;
  v_previous numeric;
  v_part numeric;
  v_count integer := 0;
  m integer;
  i integer;
begin
  if v_user is null or not public.is_approved_profile() then
    raise exception 'Usuario nao autorizado.' using errcode = '42501';
  end if;
  if p_receita_id is not null and not public.has_profile_role(array['admin','rh']) then
    raise exception 'Seu perfil nao pode editar receitas.' using errcode = '42501';
  end if;
  if v_start is null or v_total is null or v_total <= 0 or v_total <> round(v_total, 2)
    or v_total::text in ('NaN','Infinity','-Infinity')
    or v_quantity not between 1 and 60
    or nullif(btrim(p_dados->>'nome'), '') is null
    or nullif(btrim(p_dados->>'cliente'), '') is null then
    raise exception 'Preencha data, nome, cliente e valor positivo; quantidade entre 1 e 60.';
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_typeof(v_deducoes) <> 'array'
    or jsonb_array_length(v_items) > 100 or jsonb_array_length(v_deducoes) > 100 then
    raise exception 'Rateios ou deducoes invalidos (maximo de 100 itens).';
  end if;
  v_split := jsonb_array_length(v_items) > 0;

  if p_receita_id is not null then
    select * into strict v_target from public.receitas where id = p_receita_id;
    perform pg_advisory_xact_lock(hashtextextended(coalesce(v_target.rateio_lote_id, p_receita_id)::text, 0));
    select * into strict v_target from public.receitas where id = p_receita_id for update;
    if v_target.receita_pai_id is not null and (v_split or v_quantity > 1 or jsonb_array_length(v_deducoes) > 0) then
      raise exception 'Edite uma deducao vinculada individualmente.';
    end if;
    if v_target.rateio_lote_id is not null and not p_editar_lote and (v_split or v_quantity > 1) then
      raise exception 'Use Editar lote para dividir ou repetir um lote existente.';
    end if;
    if p_editar_lote and v_target.rateio_lote_id is not null then
      if not v_split then raise exception 'Mantenha os itens do lote no rateio.'; end if;
      perform 1 from public.receitas where rateio_lote_id = v_target.rateio_lote_id order by id for update;
      select array_agg(id) into v_ids from public.receitas
        where rateio_lote_id = v_target.rateio_lote_id and receita_pai_id is null;
    else
      v_ids := array[p_receita_id];
    end if;
  end if;

  if not v_split then v_items := jsonb_build_array(p_dados - 'rateios' - 'deducoes'); end if;
  if v_split and (select sum((value->>'valor')::numeric) from jsonb_array_elements(v_items)) is distinct from v_total then
    raise exception 'A soma dos rateios deve ser igual ao valor geral.';
  end if;
  v_kept := array[]::uuid[];
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_value := (v_item->>'valor')::numeric;
    if v_value is null or v_value <= 0 or v_value <> round(v_value,2) or v_value::text in ('NaN','Infinity','-Infinity')
      or nullif(btrim(v_item->>'cliente'), '') is null
      or not exists (select 1 from public.unidades where codigo = v_item->>'unidade_codigo' and ativo)
      or not exists (select 1 from public.setor where codigo = v_item->>'setor_codigo' and ativo) then
      raise exception 'Cada item precisa de cliente, unidade, centro de custo e valor positivo validos.';
    end if;
    perform public.validar_receita_plano_conta((v_item->>'plano_conta_id')::uuid);
    if (v_split or jsonb_array_length(v_deducoes) > 0) and not exists (
      select 1 from public.plano_contas where id = (v_item->>'plano_conta_id')::uuid and natureza = 'Receita'
    ) then raise exception 'Rateios e deducoes devem estar vinculados a uma conta de Receita.'; end if;
    if v_target.receita_pai_id is not null and not exists (
      select 1 from public.plano_contas where id = (v_item->>'plano_conta_id')::uuid and natureza = 'Dedução'
    ) then raise exception 'Uma deducao vinculada deve manter a natureza Deducao.'; end if;
    v_item_id := nullif(v_item->>'id','')::uuid;
    if v_item_id is not null then
      if not (p_editar_lote and v_target.rateio_lote_id is not null)
        or not (v_item_id = any(v_ids)) or v_item_id = any(v_kept) then
        raise exception 'Item repetido ou fora do lote em edicao.';
      end if;
      v_kept := array_append(v_kept, v_item_id);
    end if;
  end loop;

  v_tax_total := 0;
  for v_tax in select value from jsonb_array_elements(v_deducoes) loop
    v_value := (v_tax->>'valor')::numeric;
    if v_value is null or v_value <= 0 or v_value <> round(v_value,2) or v_value::text in ('NaN','Infinity','-Infinity')
      or not exists (select 1 from public.plano_contas where id = (v_tax->>'plano_conta_id')::uuid
        and natureza = 'Dedução' and ativo and e_analitica) then
      raise exception 'Conta ou valor de deducao invalido.';
    end if;
    v_tax_total := v_tax_total + v_value;
  end loop;
  if v_tax_total > v_total then raise exception 'Deducoes maiores que a receita.'; end if;

  v_kept := array[]::uuid[];
  for m in 0..v_quantity - 1 loop
    v_month := (date_trunc('month', v_start) + make_interval(months => m))::date;
    v_date := v_month + (least(extract(day from v_start)::integer,
      extract(day from (v_month + interval '1 month - 1 day'))::integer) - 1);
    v_group := case when v_split then
      case when m = 0 then coalesce(v_target.rateio_lote_id, gen_random_uuid()) else gen_random_uuid() end
      else v_target.rateio_lote_id end;
    v_month_ids := array[]::uuid[];
    v_capacities := array[]::numeric[];
    i := 0;
    for v_item in select value from jsonb_array_elements(v_items) loop
      i := i + 1;
      v_id := case when m = 0 then nullif(v_item->>'id','')::uuid else null end;
      if m = 0 and i = 1 and p_receita_id is not null and not (p_editar_lote and v_target.rateio_lote_id is not null) then
        v_id := p_receita_id;
      end if;
      v_row := null;
      if v_id is not null then select * into strict v_row from public.receitas where id = v_id; end if;
      v_row.id := coalesce(v_id, gen_random_uuid());
      v_row.data_recebimento := v_date;
      v_row.nome := btrim(p_dados->>'nome');
      v_row.cliente := btrim(v_item->>'cliente');
      v_row.descricao := nullif(btrim(p_dados->>'descricao'), '');
      v_row.valor := (v_item->>'valor')::numeric;
      v_row.plano_conta_id := (v_item->>'plano_conta_id')::uuid;
      v_row.unidade_codigo := v_item->>'unidade_codigo';
      v_row.setor_codigo := v_item->>'setor_codigo';
      v_row.banco := nullif(btrim(p_dados->>'banco'), '');
      v_row.forma_recebimento := nullif(btrim(p_dados->>'forma_recebimento'), '');
      v_row.documento := nullif(btrim(p_dados->>'documento'), '');
      v_row.rateio_lote_id := v_group;
      v_row.rateio_cliente_geral := case when v_split then btrim(p_dados->>'cliente') else v_target.rateio_cliente_geral end;
      v_row.rateio_item_ordem := case when v_split then i else v_target.rateio_item_ordem end;
      v_row.parcela_numero := case when v_quantity > 1 then m + 1 else v_target.parcela_numero end;
      v_row.parcela_total := case when v_quantity > 1 then v_quantity else v_target.parcela_total end;
      if v_id is null then
        v_row.created_by := v_user;
        v_row.created_at := now();
        v_row.updated_at := now();
        insert into public.receitas select (v_row).*;
      else
        update public.receitas set data_recebimento=v_row.data_recebimento, nome=v_row.nome,
          cliente=v_row.cliente, descricao=v_row.descricao, valor=v_row.valor,
          plano_conta_id=v_row.plano_conta_id, unidade_codigo=v_row.unidade_codigo,
          setor_codigo=v_row.setor_codigo, banco=v_row.banco, forma_recebimento=v_row.forma_recebimento,
          documento=v_row.documento, rateio_lote_id=v_row.rateio_lote_id,
          rateio_cliente_geral=v_row.rateio_cliente_geral, rateio_item_ordem=v_row.rateio_item_ordem,
          parcela_numero=v_row.parcela_numero, parcela_total=v_row.parcela_total
        where id=v_id;
        if not found then raise exception 'Receita nao atualizada: verifique suas permissoes.'; end if;
        delete from public.receitas where receita_pai_id=v_id;
      end if;
      if m = 0 then v_kept := array_append(v_kept, v_row.id); end if;
      v_month_ids := array_append(v_month_ids, v_row.id);
      v_capacities := array_append(v_capacities, v_row.valor);
      v_count := v_count + 1;
    end loop;

    -- Allocate each tax in cents against remaining capacity, preserving every tax total
    -- and preventing rounding from making an item's deductions exceed its gross value.
    for v_tax in select value from jsonb_array_elements(v_deducoes) loop
      select sum(c) into v_capacity_total from unnest(v_capacities) c;
      v_cumulative := 0;
      v_previous := 0;
      for i in 1..array_length(v_month_ids,1) loop
        v_cumulative := v_cumulative + v_capacities[i];
        v_part := round((v_tax->>'valor')::numeric * v_cumulative / v_capacity_total, 2) - v_previous;
        v_previous := v_previous + v_part;
        v_capacities[i] := v_capacities[i] - v_part;
        if v_part > 0 then
          select * into strict v_row from public.receitas where id=v_month_ids[i];
          v_row.receita_pai_id := v_row.id;
          v_row.id := gen_random_uuid();
          v_row.valor := v_part;
          v_row.plano_conta_id := (v_tax->>'plano_conta_id')::uuid;
          v_row.descricao := nullif(btrim(v_tax->>'descricao'), '');
          v_row.rateio_lote_id := null;
          v_row.rateio_cliente_geral := null;
          v_row.rateio_item_ordem := null;
          v_row.created_by := v_user;
          v_row.created_at := now();
          v_row.updated_at := now();
          insert into public.receitas select (v_row).*;
        end if;
      end loop;
    end loop;
  end loop;
  delete from public.receitas where id=any(v_ids) and not (id=any(v_kept));
  return jsonb_build_object('lancamentos',v_count,'meses',v_quantity);
end;
$$;

revoke all on function public.salvar_receita_com_rateios(jsonb,uuid,boolean) from public, anon;
grant execute on function public.salvar_receita_com_rateios(jsonb,uuid,boolean) to authenticated;
grant select on public.vw_receitas_plano_contas to authenticated;
