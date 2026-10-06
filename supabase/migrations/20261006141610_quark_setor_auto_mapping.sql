-- Only explicit equivalents are recognized. Existing manual mappings win.
create function public.normalize_quark_setor_name(p_name text) returns text
language sql immutable security invoker set search_path='' as $$
 select trim(regexp_replace(translate(upper(replace(coalesce(p_name,''),'&',' E ')),
 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC'),'[^A-Z0-9]+',' ','g'))
$$;
revoke all on function public.normalize_quark_setor_name(text) from public,anon;
grant execute on function public.normalize_quark_setor_name(text) to authenticated,service_role;

create function public.resolve_quark_setor_name(p_name text) returns text
language sql stable security invoker set search_path='' as $$
 with aliases(nome,codigo) as (values
  ('TECNICO DE CAMPO ADS E SERV','S001'),
  ('TECNICO DE CAMPO VT','S003'),
  ('TECNICO DE CAMPO MDU MANUT','S004'),
  ('TECNICO DE CAMPO MDU CONST','S005'),
  ('SUPORTE DE CAMPO ADS E SERV','S007'),
  ('SUPORTE DE CAMPO VT','S009'),
  ('SUPORTE DE CAMPO MDU MANUT','S010'),
  ('SUPORTE DE CAMPO MDU CONST','S011'),
  ('COMERCIAL TLMK','S013'),
  ('RH DP','S020'),
  ('DIRETORIA','S022'),
  ('SEG TRAB','S027'),
  ('SEGURANCA DO TRABALHO','S027'),
  ('COMERCIAL AFASTADO','S029'),
  ('TECNICA AFASTADO','S030')
 ), city_aliases(nome,codigo) as (
  select a.nome||' '||city.suffix,a.codigo from aliases a
  cross join (values('NAT'),('NATAL'),('REC'),('RECIFE'),('FORT'),('FORTALEZA'),('MOSSORO')) city(suffix)
  where a.codigo in ('S001','S003','S004','S005','S007','S009','S010','S011')
 ), other_aliases(nome,codigo) as (values ('COMERCIAL BKO NAT','S026')),
 candidates as (
  select codigo from public.setor where ativo and public.normalize_quark_setor_name(setor)=public.normalize_quark_setor_name(p_name)
  union
  select s.codigo from (select * from aliases union all select * from city_aliases union all select * from other_aliases) a
  join public.setor s on s.codigo=a.codigo and s.ativo
  where public.normalize_quark_setor_name(a.nome)=public.normalize_quark_setor_name(p_name)
 ) select case when count(distinct codigo)=1 then min(codigo) else null end from candidates
$$;
revoke all on function public.resolve_quark_setor_name(text) from public,anon;
grant execute on function public.resolve_quark_setor_name(text) to authenticated,service_role;

create function public.trg_quark_setor_auto_mapping() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.setor_codigo is null then
  new.setor_codigo:=public.resolve_quark_setor_name(new.quark_setor_nome);
 end if;
 return new;
end $$;
revoke all on function public.trg_quark_setor_auto_mapping() from public,anon;
grant execute on function public.trg_quark_setor_auto_mapping() to authenticated,service_role;
create trigger quark_setor_auto_mapping before insert or update of quark_setor_nome,setor_codigo
 on public.quark_setor_mapping for each row execute function public.trg_quark_setor_auto_mapping();

-- Resolve already received teams without making another call to the API.
update public.quark_setor_mapping m set setor_codigo=public.resolve_quark_setor_name(m.quark_setor_nome),updated_at=now()
 where m.setor_codigo is null and public.resolve_quark_setor_name(m.quark_setor_nome) is not null;
update public.registros_dados r set setor_codigo=m.setor_codigo,setor=s.setor,
 quark_setor_pendente=false,ultima_origem_atualizacao='QuarkRH',updated_at=now()
 from public.quark_setor_mapping m join public.setor s on s.codigo=m.setor_codigo and s.ativo
 where r.quark_unidade_id=m.quark_unidade_id and r.quark_setor_id=m.quark_setor_id
 and r.quark_setor_pendente;
