begin;
set local statement_timeout = '60s';
do $$
begin
  perform set_config('test.admin', (select id::text from public.profiles where approved and role = 'admin' order by id limit 1), true);
  perform set_config('test.rh', (select id::text from public.profiles where approved and role = 'rh' order by id limit 1), true);
  perform set_config('test.rh_other', (select id::text from public.profiles where approved and role = 'rh' order by id offset 1 limit 1), true);
  perform set_config('test.assistant', (select id::text from public.profiles where approved and role = 'assistente_financeiro' order by id limit 1), true);
  if nullif(current_setting('test.rh'),'') is null or nullif(current_setting('test.admin'),'') is null then
    raise exception 'Tests require approved admin and RH profiles.';
  end if;
end $$;
set local role authenticated;
do $$
declare
  source text;
  payload jsonb;
  request_id uuid;
  other_id uuid;
  rows_applied integer;
  result_count integer;
  failure boolean;
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.rh'),'role','authenticated')::text,true);
  foreach source in array array['lancamentos_pix','dados_financeiro','beneficios_combustivel','beneficios_agregamento','beneficios_flash'] loop
    payload := case when source = 'dados_financeiro'
      then '[{"data":"2100-01-01","cpf":"00000000191","nome":"RH_APPROVAL_TEST","salario_liquido":12.34}]'::jsonb
      when source = 'lancamentos_pix'
      then '[{"data_lancamento":"2100-01-01","nome":"RH_APPROVAL_TEST","valor":12.34}]'::jsonb
      else '[{"data_beneficio":"2100-01-01","cpf":"00000000191","nome":"RH_APPROVAL_TEST","valor":12.34}]'::jsonb end;
    if source = 'beneficios_combustivel' then payload := jsonb_build_array(payload->0 || '{"placa":"TST1234"}'::jsonb); end if;
    if source = 'beneficios_flash' then payload := jsonb_build_array(payload->0 || '{"tipo_beneficio":"Flash VT"}'::jsonb); end if;
    request_id := public.submit_financial_approval(source,payload,'approval-test.xlsx');
    perform set_config('test.' || source,request_id::text,true);
    if request_id <> public.submit_financial_approval(source,payload,'approval-test.xlsx') then raise exception 'Pending duplicate not idempotent'; end if;
    if not exists(select 1 from public.financial_approval_requests where id=request_id and status='pending' and row_count=1 and total_amount=12.34 and requester_id=auth.uid() and requester_email=(select email from public.profiles where id=auth.uid())) then
      raise exception 'Pending metadata is incorrect';
    end if;
    execute format('select count(*) from public.%I where nome = ''RH_APPROVAL_TEST''',source) into result_count;
    if result_count <> 0 then raise exception 'Pending records leaked to live data'; end if;
    failure := false;
    begin perform public.review_financial_approval(request_id,true,null); exception when insufficient_privilege then failure:=true; end;
    if not failure then raise exception 'RH approved its own submission'; end if;
    failure := false;
    begin
      execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1)',source,source) using payload;
    exception when insufficient_privilege then failure:=true; end;
    if not failure then raise exception 'Direct RH write bypassed approval'; end if;
  end loop;
  failure := false;
  begin
    perform public.submit_financial_approval('profiles','[{"role":"admin"}]',null);
  exception when raise_exception then failure:=true; end;
  if not failure then raise exception 'Arbitrary table allowed'; end if;
  failure := false;
  begin
    perform public.submit_financial_approval('lancamentos_pix','[{"data_lancamento":"2100-01-01","valor":1,"created_by":"00000000-0000-4000-8000-000000000001"}]',null);
  exception when raise_exception then failure:=true; end;
  if not failure then raise exception 'Protected author field allowed'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.rh_other'),'role','authenticated')::text,true);
  if exists(select 1 from public.financial_approval_requests where id=current_setting('test.lancamentos_pix')::uuid) then raise exception 'RH read another requester payload'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.assistant'),'role','authenticated')::text,true);
  if exists(select 1 from public.financial_approval_requests) then raise exception 'Assistant can read approval queue'; end if;
  failure := false;
  begin perform public.review_financial_approval(current_setting('test.lancamentos_pix')::uuid,true,null); exception when insufficient_privilege then failure:=true; end;
  if not failure then raise exception 'Assistant can approve'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
  foreach source in array array['lancamentos_pix','dados_financeiro','beneficios_combustivel','beneficios_agregamento','beneficios_flash'] loop
    request_id := current_setting('test.' || source)::uuid;
    rows_applied := public.review_financial_approval(request_id,true,'Reviewed test');
    if rows_applied <> 1 then raise exception 'Expected one applied row: %', source; end if;
    execute format('select count(*) from public.%I where nome = ''RH_APPROVAL_TEST''',source) into result_count;
    if result_count <> 1 then raise exception 'Approved data missing: %',source; end if;
    if not exists(select 1 from public.financial_approval_requests where id=request_id and status='approved' and reviewed_by=auth.uid() and applied_count=1) then raise exception 'Review audit missing'; end if;
    failure := false;
    begin perform public.review_financial_approval(request_id,true,null); exception when raise_exception then failure:=true; end;
    if not failure then raise exception 'Approval applied twice'; end if;
    if source <> 'dados_financeiro' then
      execute format('select count(*) from public.%I where nome=''RH_APPROVAL_TEST'' and created_by=$1',source) into result_count using current_setting('test.rh')::uuid;
      if result_count <> 1 then raise exception 'Original author lost'; end if;
    end if;
  end loop;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.rh'),'role','authenticated')::text,true);
  failure := false;
  begin update public.lancamentos_pix set valor=99 where nome='RH_APPROVAL_TEST'; exception when insufficient_privilege then failure:=true; end;
  if not failure then raise exception 'RH updated approved payment'; end if;
  failure := false;
  begin delete from public.dados_financeiro where nome='RH_APPROVAL_TEST'; exception when insufficient_privilege then failure:=true; end;
  if not failure then raise exception 'RH deleted approved payroll'; end if;
  request_id := public.submit_financial_approval('dados_financeiro','[{"data":"2100-01-01","cpf":"00000000191","nome":"RH_APPROVAL_TEST","salario_liquido":20}]','payroll-correction.xlsx');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
  if public.review_financial_approval(request_id,true,null) <> 1 then raise exception 'Payroll correction failed'; end if;
  if (select count(*) from public.dados_financeiro where cpf='00000000191' and data='2100-01-01') <> 1 or
    not exists(select 1 from public.dados_financeiro where cpf='00000000191' and data='2100-01-01' and salario_liquido=20) then
    raise exception 'Payroll upsert duplicated or lost the correction';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.rh'),'role','authenticated')::text,true);
  request_id := public.submit_financial_approval('lancamentos_pix','[{"data_lancamento":"2100-02-01","nome":"RH_MONTHLY_TEST","valor":50,"parcela_numero":1,"parcela_total":2},{"data_lancamento":"2100-03-01","nome":"RH_MONTHLY_TEST","valor":50,"parcela_numero":2,"parcela_total":2}]',null);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
  if public.review_financial_approval(request_id,true,null) <> 2 then raise exception 'Monthly payment batch lost lines'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.rh'),'role','authenticated')::text,true);
  request_id := public.submit_financial_approval('beneficios_flash','[{"data_beneficio":"2100-01-01","cpf":"00000000191","nome":"RH_APPROVAL_TEST","valor":12.34,"tipo_beneficio":"Flash VT"}]','duplicate.xlsx');
  other_id := public.submit_financial_approval('lancamentos_pix','[{"data_lancamento":"2100-01-01","nome":"RH_REJECTED_TEST","valor":99}]',null);
  perform set_config('test.rejected',other_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
  if public.review_financial_approval(request_id,true,null) <> 0 then raise exception 'Approved duplicated benefit twice'; end if;
  perform public.review_financial_approval(other_id,false,'Rejected test');
  if exists(select 1 from public.lancamentos_pix where nome='RH_REJECTED_TEST') then raise exception 'Rejected records became live'; end if;

  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.rh'),'role','authenticated')::text,true);
  request_id := public.submit_financial_approval('lancamentos_pix','[{"data_lancamento":"2100-01-01","nome":"RH_ATOMIC_TEST","valor":5},{"data_lancamento":"2100-01-01","nome":"RH_ATOMIC_TEST","valor":7,"plano_conta_id":"00000000-0000-4000-8000-000000000001"}]',null);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
  failure := false;
  begin perform public.review_financial_approval(request_id,true,null); exception when foreign_key_violation or check_violation then failure:=true; end;
  if not failure then raise exception 'Invalid FK unexpectedly approved'; end if;
  if exists(select 1 from public.lancamentos_pix where nome='RH_ATOMIC_TEST') then raise exception 'Approval partially committed'; end if;
  if not exists(select 1 from public.financial_approval_requests where id=request_id and status='pending') then raise exception 'Failed approval lost pending state'; end if;
  failure := false;
  begin update public.financial_approval_requests set status='approved' where id=request_id; exception when insufficient_privilege then failure:=true; end;
  if not failure then raise exception 'Direct queue update allowed'; end if;
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
  failure := false;
  begin perform public.submit_financial_approval('lancamentos_pix','[{"data_lancamento":"2100-01-01","valor":1}]',null); exception when insufficient_privilege then failure:=true; end;
  if not failure then raise exception 'Unapproved user submitted a request'; end if;
end $$;
reset role;
set local role anon;
do $$
declare failure boolean := false;
begin
  begin perform public.submit_financial_approval('lancamentos_pix','[]',null); exception when insufficient_privilege then failure:=true; end;
  if not failure then raise exception 'Anonymous submission allowed'; end if;
  failure := false;
  begin perform 1 from public.financial_approval_requests; exception when insufficient_privilege then failure:=true; end;
  if not failure then raise exception 'Anonymous queue read allowed'; end if;
end $$;
reset role;
rollback;
