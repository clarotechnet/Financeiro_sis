create schema if not exists private;

create table public.financial_approval_requests (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('lancamentos_pix', 'dados_financeiro', 'beneficios_combustivel', 'beneficios_agregamento', 'beneficios_flash')),
  requester_id uuid references auth.users(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  file_name text,
  records jsonb not null check (jsonb_typeof(records) = 'array'),
  payload_hash text not null,
  row_count integer not null check (row_count between 1 and 20000),
  total_amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_email text,
  review_note text,
  applied_count integer,
  check ((status = 'pending' and reviewed_at is null) or (status <> 'pending' and reviewed_at is not null))
);
create index financial_approval_status_date_idx on public.financial_approval_requests(status, created_at desc);
create index financial_approval_requester_idx on public.financial_approval_requests(requester_id, created_at desc);
create index financial_approval_reviewer_idx on public.financial_approval_requests(reviewed_by);
create unique index financial_approval_pending_hash_idx on public.financial_approval_requests(requester_id, payload_hash) where status = 'pending';
alter table public.financial_approval_requests enable row level security;
revoke all on public.financial_approval_requests from public, anon, authenticated;
grant select on public.financial_approval_requests to authenticated;
create policy "admin or requester can read financial approvals"
on public.financial_approval_requests for select to authenticated
using ((select public.has_profile_role(array['admin'])) or ((select public.has_profile_role(array['rh'])) and requester_id = (select auth.uid())));

create function private.submit_financial_approval(p_source text, p_records jsonb, p_file_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor public.profiles%rowtype;
  request_id uuid;
  fingerprint text;
  allowed_columns text[];
  amount numeric;
  batch record;
begin
  if auth.uid() is null or not public.has_profile_role(array['rh']) then
    raise exception 'Somente RH aprovado pode enviar para aprovacao.' using errcode = '42501';
  end if;
  if p_source not in ('lancamentos_pix', 'dados_financeiro', 'beneficios_combustivel', 'beneficios_agregamento', 'beneficios_flash') or p_source is null then
    raise exception 'Origem de envio invalida.';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then raise exception 'Dados de envio invalidos.'; end if;
  if jsonb_array_length(p_records) not between 1 and 20000 or octet_length(p_records::text) > 15000000 then
    raise exception 'Envie entre 1 e 20000 linhas, com ate 15 MB.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_records) r where jsonb_typeof(r) <> 'object') then
    raise exception 'Cada linha precisa ser um objeto.';
  end if;
  select array_agg(a.attname::text) into allowed_columns
  from pg_catalog.pg_attribute a
  where a.attrelid = pg_catalog.to_regclass('public.' || p_source) and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('id', 'created_by', 'created_at', 'updated_at');
  if exists (select 1 from jsonb_array_elements(p_records) r cross join lateral jsonb_object_keys(r) k where not k = any(allowed_columns)) then
    raise exception 'O envio contem campos nao permitidos.';
  end if;
  -- Validate casts now; table constraints and references are checked atomically on approval.
  execute format('select count(*) from jsonb_populate_recordset(null::public.%I, $1)', p_source) using p_records;
  if p_source = 'dados_financeiro' then
    if exists (select 1 from jsonb_array_elements(p_records) r where nullif(r->>'data','') is null or nullif(btrim(r->>'cpf'),'') is null or nullif(btrim(r->>'nome'),'') is null) then
      raise exception 'Folha exige data, CPF e nome em cada linha.';
    end if;
  elsif p_source like 'beneficios_%' then
    if exists (select 1 from jsonb_array_elements(p_records) r where nullif(r->>'data_beneficio','') is null or nullif(btrim(r->>'cpf'),'') is null or nullif(btrim(r->>'nome'),'') is null or coalesce((r->>'valor')::numeric,0) <= 0) then
      raise exception 'Beneficios exigem data, CPF, nome e valor positivo.';
    end if;
  else
    if exists (select 1 from jsonb_array_elements(p_records) r where nullif(r->>'data_lancamento','') is null or r->>'valor' is null) then
      raise exception 'Pagamentos exigem data e valor.';
    end if;
  end if;
  select * into strict actor from public.profiles where id = auth.uid();
  select coalesce(sum((r->>case when p_source = 'dados_financeiro' then 'salario_liquido' else 'valor' end)::numeric),0)
    into amount from jsonb_array_elements(p_records) r;
  fingerprint := encode(sha256(convert_to(p_source || p_records::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || fingerprint,0));
  select id into request_id from public.financial_approval_requests
    where requester_id = auth.uid() and payload_hash = fingerprint and status = 'pending';
  if request_id is not null then return request_id; end if;
  insert into public.financial_approval_requests(source, requester_id, requester_name, requester_email, file_name, records, payload_hash, row_count, total_amount)
  values(p_source, auth.uid(), coalesce(nullif(actor.display_name,''),actor.email,''), coalesce(actor.email,''), left(nullif(btrim(p_file_name),''),255), p_records, fingerprint, jsonb_array_length(p_records), amount)
  returning id into request_id;
  return request_id;
end $$;

create function private.review_financial_approval(p_request_id uuid, p_approve boolean, p_note text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  request public.financial_approval_requests%rowtype;
  batch record;
  columns_sql text;
  updates_sql text;
  select_sql text;
  conflict_sql text;
  predicate_sql text;
  distinct_sql text;
  changed integer;
  applied integer := 0;
begin
  if auth.uid() is null or not public.has_profile_role(array['admin']) then
    raise exception 'Somente administrador pode aprovar ou recusar.' using errcode = '42501';
  end if;
  if p_approve is null then raise exception 'Informe a decisao.'; end if;
  select * into request from public.financial_approval_requests where id = p_request_id for update;
  if not found then raise exception 'Envio nao encontrado.'; end if;
  if request.status <> 'pending' then raise exception 'Este envio ja foi analisado. Atualize a lista.'; end if;
  if not p_approve and nullif(btrim(p_note),'') is null then raise exception 'Informe o motivo da recusa.'; end if;
  if p_approve then
    -- Serialize approvals to make duplicate checks safe across different requests.
    perform pg_advisory_xact_lock(hashtextextended('financial-approval:' || request.source,0));
    for batch in
      select keys, jsonb_agg(item) as rows from (
        select value as item, array(select jsonb_object_keys(value) order by 1) as keys
        from jsonb_array_elements(request.records)
      ) items group by keys
    loop
      select string_agg(format('%I', k), ', '), string_agg(format('r.%I', k), ', '),
        string_agg(format('%I = excluded.%I', k, k), ', ')
      into columns_sql, select_sql, updates_sql from unnest(batch.keys) k;
      conflict_sql := ' on conflict do nothing';
      predicate_sql := '';
      distinct_sql := '';
      if request.source = 'dados_financeiro' then
        conflict_sql := ' on conflict (data, cpf) do update set ' || updates_sql || ', updated_at = now()';
      else
        columns_sql := columns_sql || ', created_by';
        select_sql := select_sql || ', $2';
      end if;
      if request.source like 'beneficios_%' then
        predicate_sql := format(' where not exists (select 1 from public.%I e where e.data_beneficio = r.data_beneficio and e.cpf = r.cpf and e.valor = r.valor',request.source);
        distinct_sql := 'distinct on (r.data_beneficio, r.cpf, r.valor';
        if request.source = 'beneficios_combustivel' then
          predicate_sql := predicate_sql || ' and regexp_replace(upper(coalesce(e.placa,'''')), ''[^A-Z0-9]'', '''', ''g'') = regexp_replace(upper(coalesce(r.placa,'''')), ''[^A-Z0-9]'', '''', ''g'')';
          distinct_sql := distinct_sql || ', r.placa';
        elsif request.source = 'beneficios_flash' then
          predicate_sql := predicate_sql || ' and (e.tipo_beneficio is null or e.tipo_beneficio is not distinct from r.tipo_beneficio)';
          distinct_sql := distinct_sql || ', r.tipo_beneficio';
        end if;
        predicate_sql := predicate_sql || ')';
        distinct_sql := distinct_sql || ') ';
      end if;
      execute format('insert into public.%I (%s) select %s%s from jsonb_populate_recordset(null::public.%I, $1) r%s%s',
        request.source, columns_sql, distinct_sql, select_sql, request.source, predicate_sql, conflict_sql)
      using batch.rows, request.requester_id;
      get diagnostics changed = row_count;
      applied := applied + changed;
    end loop;
  end if;
  update public.financial_approval_requests set
    status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_at = now(), reviewed_by = auth.uid(),
    reviewer_email = (select email from public.profiles where id = auth.uid()),
    review_note = left(nullif(btrim(p_note),''),2000), applied_count = applied
  where id = request.id;
  return applied;
end $$;

create function public.submit_financial_approval(p_source text, p_records jsonb, p_file_name text default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.submit_financial_approval(p_source,p_records,p_file_name);
$$;
create function public.review_financial_approval(p_request_id uuid, p_approve boolean, p_note text default null)
returns integer language sql security invoker set search_path = '' as $$
  select private.review_financial_approval(p_request_id,p_approve,p_note);
$$;
revoke all on function private.submit_financial_approval(text,jsonb,text), private.review_financial_approval(uuid,boolean,text), public.submit_financial_approval(text,jsonb,text), public.review_financial_approval(uuid,boolean,text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.submit_financial_approval(text,jsonb,text), private.review_financial_approval(uuid,boolean,text), public.submit_financial_approval(text,jsonb,text), public.review_financial_approval(uuid,boolean,text) to authenticated;

create function private.guard_approved_financial_writes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null or coalesce(auth.role(),'') in ('anon','authenticated') then
    if public.has_profile_role(array['rh']) then
      raise exception 'Envios de RH exigem aprovacao de um administrador.' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' and tg_table_name <> 'dados_financeiro' then
      if not public.has_profile_role(array['admin','assistente_financeiro']) then
        raise exception 'Sem permissao para lancar dados financeiros.' using errcode = '42501';
      end if;
    elsif not public.has_profile_role(array['admin']) then
      raise exception 'Somente administrador pode alterar dados financeiros aprovados.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.guard_approved_financial_writes() from public, anon, authenticated;
do $$
declare target text;
begin
  foreach target in array array['lancamentos_pix','dados_financeiro','beneficios_combustivel','beneficios_agregamento','beneficios_flash'] loop
    execute format('create trigger enforce_financial_approval before insert or update or delete on public.%I for each row execute function private.guard_approved_financial_writes()', target);
  end loop;
end $$;
notify pgrst, 'reload schema';
