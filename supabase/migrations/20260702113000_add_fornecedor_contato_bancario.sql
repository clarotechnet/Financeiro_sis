-- Acrescenta dados de contato e dados bancarios ao cadastro de fornecedores.

do $$
begin
  if to_regclass('public.fornecedores') is null then
    raise exception 'A tabela public.fornecedores precisa existir antes desta migration.';
  end if;
end $$;

alter table public.fornecedores
  add column if not exists telefone text null,
  add column if not exists email text null,
  add column if not exists banco text null,
  add column if not exists agencia text null,
  add column if not exists conta text null,
  add column if not exists chave_pix text null;

comment on column public.fornecedores.telefone is
  'Telefone de contato do fornecedor.';
comment on column public.fornecedores.email is
  'Email de contato do fornecedor.';
comment on column public.fornecedores.banco is
  'Nome do banco do fornecedor. Campo livre e individual do cadastro do fornecedor.';
comment on column public.fornecedores.agencia is
  'Agencia bancaria do fornecedor.';
comment on column public.fornecedores.conta is
  'Conta bancaria do fornecedor.';
comment on column public.fornecedores.chave_pix is
  'Chave PIX do fornecedor.';

create index if not exists idx_fornecedores_banco_lookup
  on public.fornecedores(lower(btrim(banco)))
  where banco is not null and ativo = true;

create index if not exists idx_fornecedores_email_lookup
  on public.fornecedores(lower(btrim(email)))
  where email is not null and ativo = true;

create or replace view public.vw_fornecedores
with (security_invoker = on) as
select
  f.id,
  f.cnpj,
  f.nome,
  f.unidade_codigo,
  u.unidade as unidade_nome,
  f.setor_codigo,
  s.setor as setor_nome,
  f.ativo,
  f.created_by,
  f.created_at,
  f.updated_at,
  f.telefone,
  f.email,
  f.banco,
  f.agencia,
  f.conta,
  f.chave_pix
from public.fornecedores f
left join public.unidades u on u.codigo = f.unidade_codigo
left join public.setor s on s.codigo = f.setor_codigo;

grant select on public.vw_fornecedores to authenticated;
