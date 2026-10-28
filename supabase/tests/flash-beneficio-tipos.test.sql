begin;

do $$
declare
  admin_id uuid;
  rh_id uuid;
  assistant_id uuid;
begin
  select id into admin_id from public.profiles where role = 'admin' and approved limit 1;
  select id into rh_id from public.profiles where role = 'rh' and approved limit 1;
  select id into assistant_id from public.profiles where role = 'assistente_financeiro' and approved limit 1;
  if admin_id is null or rh_id is null or assistant_id is null then
    raise exception 'Os testes precisam de perfis aprovados admin, RH e assistente.';
  end if;
  perform set_config('test.flash_admin_id', admin_id::text, true);
  perform set_config('test.flash_rh_id', rh_id::text, true);
  perform set_config('test.flash_assistant_id', assistant_id::text, true);
  if has_table_privilege('anon', 'public.beneficios_flash_tipos', 'SELECT')
     or has_table_privilege('anon', 'public.beneficios_flash_tipos', 'INSERT') then
    raise exception 'Anon nao deve acessar o catalogo Flash.';
  end if;
  if has_table_privilege('authenticated', 'public.beneficios_flash_tipos', 'UPDATE')
     or has_table_privilege('authenticated', 'public.beneficios_flash_tipos', 'DELETE') then
    raise exception 'O cadastro nao deve conceder alteracao ou exclusao.';
  end if;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
end $$;

set local role authenticated;
do $$
begin
  insert into public.beneficios_flash_tipos(nome) values ('Flash Teste Transacional Admin');
  if not exists (select 1 from public.beneficios_flash_tipos where nome = 'Flash Teste Transacional Admin') then
    raise exception 'Administrador deve conseguir ler o tipo cadastrado.';
  end if;
  begin
    insert into public.beneficios_flash_tipos(nome) values ('flash teste transacional admin');
    raise exception 'Um nome repetido foi aceito.';
  exception when unique_violation then null;
  end;
  begin
    insert into public.beneficios_flash_tipos(nome) values (' ');
    raise exception 'Um nome vazio foi aceito.';
  exception when check_violation then null;
  end;
  begin
    insert into public.beneficios_flash_tipos(nome) values ('Flash (legado)');
    raise exception 'O nome reservado foi aceito.';
  exception when check_violation then null;
  end;
  insert into public.beneficios_flash(data_beneficio, cpf, nome, valor, tipo_beneficio)
  values ('2026-10-28', '00000000000', 'Teste transacional Flash', 1, 'Flash Teste Transacional Admin');
  begin
    insert into public.beneficios_flash(data_beneficio, cpf, nome, valor, tipo_beneficio)
    values ('2026-10-28', '00000000000', 'Teste transacional Flash', 1, 'Flash Tipo Nao Cadastrado');
    raise exception 'Um lancamento com tipo inexistente foi aceito.';
  exception when foreign_key_violation then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.flash_rh_id'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', current_setting('test.flash_rh_id'), true);
set local role authenticated;
insert into public.beneficios_flash_tipos(nome) values ('Flash Teste Transacional RH');

reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.flash_assistant_id'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', current_setting('test.flash_assistant_id'), true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.beneficios_flash_tipos where nome = 'Flash Teste Transacional Admin') then
    raise exception 'Assistente aprovado deve conseguir utilizar os tipos cadastrados.';
  end if;
  begin
    insert into public.beneficios_flash_tipos(nome) values ('Flash Teste Transacional Assistente');
    raise exception 'Assistente nao deve cadastrar tipos.';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.beneficios_flash_tipos) then
    raise exception 'Uma sessao sem usuario nao deve ler os tipos.';
  end if;
  begin
    insert into public.beneficios_flash_tipos(nome) values ('Flash Teste Transacional Sem Login');
    raise exception 'Uma sessao sem usuario nao deve cadastrar tipos.';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
select 'Catalogo Flash: cadastro, duplicidade, FK e permissoes validados com rollback.' as resultado;
