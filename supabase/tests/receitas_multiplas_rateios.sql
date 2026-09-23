-- Run against the application schema. All test entries are rolled back.
begin;
do $$
declare
  actor uuid;
  assistant_id uuid;
  income uuid;
  tax uuid;
  unit_code text;
  sector_code text;
  payload jsonb;
  updated_payload jsonb;
  batch uuid;
  first_id uuid;
  second_id uuid;
  foreign_id uuid;
  marker text := 'test-receitas-' || gen_random_uuid();
  before_rows jsonb;
  after_rows jsonb;
  original_count integer;
  rejected boolean;
  actual numeric;
begin
  select id into strict actor from public.profiles where approved and role='admin' limit 1;
  select id into assistant_id from public.profiles where approved and role='assistente_financeiro' limit 1;
  select id into strict income from public.plano_contas where ativo and e_analitica and natureza='Receita' order by codigo limit 1;
  select id into strict tax from public.plano_contas where ativo and e_analitica and natureza='Dedução' order by codigo limit 1;
  select codigo into strict unit_code from public.unidades where ativo order by codigo limit 1;
  select codigo into strict sector_code from public.setor where ativo order by codigo limit 1;
  if has_function_privilege('anon','public.salvar_receita_com_rateios(jsonb,uuid,boolean)','execute') then
    raise exception 'Anonymous execution should be revoked';
  end if;
  if (select prosecdef from pg_proc where oid='public.salvar_receita_com_rateios(jsonb,uuid,boolean)'::regprocedure) then
    raise exception 'Function must not bypass RLS';
  end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('role', 'authenticated', true);
  payload := jsonb_build_object('data_recebimento','2028-01-31','nome','Teste transacional','cliente','Lote de teste',
    'documento',marker,'valor',1000,'quantidade_receitas',3,
    'rateios',jsonb_build_array(
      jsonb_build_object('cliente','Item A','valor',600.01,'unidade_codigo',unit_code,'setor_codigo',sector_code,'plano_conta_id',income),
      jsonb_build_object('cliente','Item B','valor',399.99,'unidade_codigo',unit_code,'setor_codigo',sector_code,'plano_conta_id',income)),
    'deducoes',jsonb_build_array(jsonb_build_object('plano_conta_id',tax,'valor',100.01,'descricao','Tax A'),
      jsonb_build_object('plano_conta_id',tax,'valor',99.99,'descricao','Tax B')));
  perform public.salvar_receita_com_rateios(payload);
  if (select count(*) from public.receitas where documento=marker and receita_pai_id is null) <> 6 then raise exception 'Expected six allocated entries'; end if;
  if (select count(distinct rateio_lote_id) from public.receitas where documento=marker and receita_pai_id is null) <> 3 then raise exception 'One batch per month'; end if;
  if (select array_agg(distinct data_recebimento order by data_recebimento) from public.receitas where documento=marker) <> array['2028-01-31','2028-02-29','2028-03-31']::date[] then raise exception 'Month-end handling failed'; end if;
  if (select sum(valor) from public.receitas where documento=marker and receita_pai_id is null) <> 3000 then raise exception 'Duplicated gross amount'; end if;
  if (select sum(valor) from public.receitas where documento=marker and receita_pai_id is not null) <> 600 then raise exception 'Tax rounding failed'; end if;
  select sum(valor) into actual from public.vw_movimentos_dre where origem_id in (select id::text from public.receitas where documento=marker);
  if actual is distinct from 2400 then raise exception 'DRE net amount differs: %',actual; end if;
  select id,rateio_lote_id into strict first_id,batch from public.receitas where documento=marker and parcela_numero=1 and rateio_item_ordem=1;
  select id into strict second_id from public.receitas where rateio_lote_id=batch and rateio_item_ordem=2;
  select id into strict foreign_id from public.receitas where documento=marker and parcela_numero=2 and rateio_item_ordem=1;
  select jsonb_agg(to_jsonb(r) order by id) into before_rows from public.receitas r where documento=marker and id<>first_id and receita_pai_id is distinct from first_id;
  updated_payload := (payload - 'rateios' - 'deducoes') || jsonb_build_object('quantidade_receitas',1,'cliente','Item editado','valor',620.01,
    'unidade_codigo',unit_code,'setor_codigo',sector_code,'plano_conta_id',income,'deducoes','[]'::jsonb);
  perform public.salvar_receita_com_rateios(updated_payload,first_id,false);
  select jsonb_agg(to_jsonb(r) order by id) into after_rows from public.receitas r where documento=marker and id<>first_id and receita_pai_id is distinct from first_id;
  if before_rows is distinct from after_rows then raise exception 'Individual edit changed other items'; end if;

  updated_payload := jsonb_set(payload,'{quantidade_receitas}','1');
  updated_payload := jsonb_set(updated_payload,'{rateios,0,id}',to_jsonb(first_id));
  updated_payload := jsonb_set(updated_payload,'{rateios,1,id}',to_jsonb(second_id));
  perform public.salvar_receita_com_rateios(updated_payload,first_id,true);
  if (select sum(valor) from public.receitas where rateio_lote_id=batch) <> 1000 then raise exception 'Batch edit failed'; end if;
  if (select sum(valor) from public.receitas where receita_pai_id in (first_id,second_id)) <> 200 then raise exception 'Batch taxes failed'; end if;

  -- A single remaining item must retain the batch identity and remove only the omitted item.
  updated_payload := jsonb_set(updated_payload,'{rateios}',jsonb_build_array((updated_payload->'rateios'->0) || jsonb_build_object('valor',1000)));
  perform public.salvar_receita_com_rateios(updated_payload,first_id,true);
  if exists(select 1 from public.receitas where id=second_id or receita_pai_id=second_id) then raise exception 'Removed item or its taxes remained'; end if;
  if not exists(select 1 from public.receitas where id=foreign_id) then raise exception 'Another month was changed'; end if;
  select count(*) into original_count from public.receitas where documento=marker;

  rejected := false;
  begin
    perform public.salvar_receita_com_rateios(jsonb_set(updated_payload,'{valor}','999'),first_id,true);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Mismatched total accepted'; end if;
  rejected := false;
  begin
    perform public.salvar_receita_com_rateios(jsonb_set(updated_payload,'{rateios,0,id}',to_jsonb(foreign_id)),first_id,true);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'Foreign item accepted'; end if;
  if (select count(*) from public.receitas where documento=marker) <> original_count then raise exception 'Rejected request changed data'; end if;

  -- Ordinary receipts and repetition when editing use the same atomic save path.
  updated_payload := (payload - 'rateios' - 'deducoes') || jsonb_build_object('quantidade_receitas',1,'valor',10,
    'unidade_codigo',unit_code,'setor_codigo',sector_code,'plano_conta_id',income,'documento',marker || '-single');
  perform public.salvar_receita_com_rateios(updated_payload);
  select id into strict first_id from public.receitas where documento=marker || '-single';
  perform public.salvar_receita_com_rateios(jsonb_set(updated_payload,'{quantidade_receitas}','2'),first_id,false);
  if (select count(*) from public.receitas where documento=marker || '-single') <> 2 then raise exception 'Editing monthly recurrence failed'; end if;

  -- Rounding very small allocations must conserve taxes without negative net items.
  updated_payload := jsonb_set(payload,'{quantidade_receitas}','1') || jsonb_build_object('valor',0.03,'documento',marker || '-cents');
  updated_payload := jsonb_set(updated_payload,'{rateios,0,valor}','0.01');
  updated_payload := jsonb_set(updated_payload,'{rateios,1,valor}','0.02');
  updated_payload := jsonb_set(updated_payload,'{deducoes}',jsonb_build_array(
    jsonb_build_object('plano_conta_id',tax,'valor',0.01),
    jsonb_build_object('plano_conta_id',tax,'valor',0.01),
    jsonb_build_object('plano_conta_id',tax,'valor',0.01)));
  perform public.salvar_receita_com_rateios(updated_payload);
  if (select sum(valor) from public.receitas where documento=marker || '-cents' and receita_pai_id is not null) <> 0.03 then raise exception 'Lost tax cents'; end if;
  if exists(select 1 from public.receitas p where documento=marker || '-cents' and receita_pai_id is null
    and p.valor < (select coalesce(sum(d.valor),0) from public.receitas d where d.receita_pai_id=p.id)) then raise exception 'Tax allocation exceeded item value'; end if;

  if assistant_id is not null then
    perform set_config('request.jwt.claim.sub',assistant_id::text,true);
    perform public.salvar_receita_com_rateios(jsonb_set(payload,'{quantidade_receitas}','1'));
    rejected := false;
    begin perform public.salvar_receita_com_rateios(updated_payload,first_id,false);
    exception when insufficient_privilege then rejected := true; end;
    if not rejected then raise exception 'Assistant updated existing entry'; end if;
  end if;
  perform set_config('request.jwt.claim.sub','',true);
  rejected := false;
  begin perform public.salvar_receita_com_rateios(payload);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Unauthenticated save accepted'; end if;
end;
$$;
rollback;
select 'PASS: recurrence, allocations, taxes, DRE, isolated editing, batch editing, rollback and permissions' as result;
