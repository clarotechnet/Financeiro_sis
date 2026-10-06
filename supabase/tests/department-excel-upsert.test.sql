-- Run against the Financeiro database; fixtures roll back.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where approved and role='admin' limit 1),'role','authenticated')::text,true);
set local role authenticated;

do $test$
declare r public.registros_dados%rowtype; result jsonb; payload jsonb; n integer; afterrow public.registros_dados%rowtype;
begin
 select * into r from public.registros_dados where quark_colaborador_id is not null limit 1;
 select count(*) into n from public.registros_dados;
 payload:=jsonb_build_array(jsonb_build_object('nome','TESTE EXCEL EXISTENTE','cpf',r.cpf,'setor_codigo','S020','unidade_codigo','2'),jsonb_build_object('nome','TESTE EXCEL NOVO','cpf','99999999995','setor_codigo','S001','unidade_codigo','2'));
 result:=public.import_department_excel(payload);
 if result->>'created'<>'1' or result->>'updated'<>'1' then raise exception 'Contagem incorreta: %',result; end if;
 select * into afterrow from public.registros_dados where id=r.id;
 if afterrow.id<>r.id or afterrow.subgrupo_plano_conta_id is distinct from r.subgrupo_plano_conta_id or afterrow.created_at<>r.created_at or afterrow.ativo is distinct from r.ativo or afterrow.origem is distinct from r.origem or afterrow.quark_colaborador_id is distinct from r.quark_colaborador_id or afterrow.quark_setor_id is distinct from r.quark_setor_id or afterrow.quark_synced_at is distinct from r.quark_synced_at then raise exception 'Importação perdeu metadados/vínculos'; end if;
 if afterrow.ultima_origem_atualizacao<>'Excel' or afterrow.setor_codigo<>'S020' then raise exception 'Dados Excel não atualizados'; end if;
 if (select origem from registros_dados where cpf='99999999995')<>'Excel' then raise exception 'Origem do novo registro incorreta'; end if;
 result:=public.import_department_excel(payload);
 if result->>'created'<>'0' or result->>'updated'<>'2' or (select count(*) from registros_dados)<>n+1 then raise exception 'Reimportação duplicou registros'; end if;
 begin
  perform public.import_department_excel(jsonb_build_array(jsonb_build_object('nome','NÃO SALVAR','cpf',r.cpf,'setor_codigo','S001','unidade_codigo','2'),jsonb_build_object('nome','ERRO','cpf','99999999994','setor_codigo','S001','unidade_codigo','INVALID')));
  raise exception 'Validação não bloqueou unidade inválida';
 exception when raise_exception then
  if sqlerrm not like 'Existem unidades%' then raise; end if;
 end;
 if (select nome from registros_dados where id=r.id)<>'TESTE EXCEL EXISTENTE' then raise exception 'Importação inválida gravou parcialmente'; end if;
end $test$;

rollback;
