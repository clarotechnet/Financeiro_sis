-- Execute in the Financeiro database; all fixture changes roll back.
begin;
create temporary table quark_before_test as select id,nome,cpf,ativo,origem,unidade_codigo,subgrupo_plano_conta_id,created_at,quark_synced_at from registros_dados;

do $test$
begin
 if public.resolve_quark_setor_name('TECNICO DE CAMPO ADS E SERV ') is distinct from 'S001' then raise exception 'Alias ADS não reconhecido'; end if;
 if public.resolve_quark_setor_name('Técnico de Campo — ADS & SERVIÇOS') is distinct from 'S001' then raise exception 'Nome canônico não reconhecido'; end if;
 if public.resolve_quark_setor_name('SUPORTE DE CAMPO ADS E SERV RECIFE') is distinct from 'S007' then raise exception 'Suporte confundido com técnico'; end if;
 if public.resolve_quark_setor_name('RH/DP ') is distinct from 'S020' then raise exception 'RH não reconhecido'; end if;
 if public.resolve_quark_setor_name('COMERCIAL TLMK') is distinct from 'S013' then raise exception 'TLMK não reconhecido'; end if;
 if public.resolve_quark_setor_name('COMERCIAL') is not null then raise exception 'Setor ambíguo foi inventado'; end if;
 if public.resolve_quark_setor_name('COMERCIAL PAP CLEYTON') is not null then raise exception 'Setor comercial foi adivinhado'; end if;
 if public.resolve_quark_setor_name('Equipe não informada') is not null then raise exception 'Equipe vazia mapeada'; end if;
 if exists(select 1 from public.registros_dados r join public.quark_setor_mapping m on r.quark_unidade_id=m.quark_unidade_id and r.quark_setor_id=m.quark_setor_id where public.resolve_quark_setor_name(m.quark_setor_nome)='S001' and r.quark_setor_pendente) then raise exception 'Pendência ADS permaneceu'; end if;
 if (select count(*) from registros_dados)<>(select count(*) from quark_before_test) then raise exception 'Total de registros alterado'; end if;
 if exists((select id,nome,cpf,ativo,origem,unidade_codigo,subgrupo_plano_conta_id,created_at,quark_synced_at from registros_dados except select * from quark_before_test) union all (select * from quark_before_test except select id,nome,cpf,ativo,origem,unidade_codigo,subgrupo_plano_conta_id,created_at,quark_synced_at from registros_dados)) then raise exception 'Campos fora do setor foram alterados'; end if;
 insert into quark_setor_mapping(quark_unidade_id,quark_setor_id,quark_setor_nome) values('9417839','AUTO_TEST','TECNICO DE CAMPO ADS E SERV');
 if (select setor_codigo from quark_setor_mapping where quark_setor_id='AUTO_TEST')<>'S001' then raise exception 'Equipe nova não mapeada'; end if;
 update quark_setor_mapping set setor_codigo='S002' where quark_setor_id='AUTO_TEST';
 update quark_setor_mapping set quark_setor_nome='TECNICO DE CAMPO ADS E SERV REC' where quark_setor_id='AUTO_TEST';
 if (select setor_codigo from quark_setor_mapping where quark_setor_id='AUTO_TEST')<>'S002' then raise exception 'Mapeamento manual sobrescrito'; end if;
end $test$;
rollback;
