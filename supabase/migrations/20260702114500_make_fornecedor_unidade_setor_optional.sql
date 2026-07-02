-- Torna Unidade e Centro de Custo opcionais no cadastro de fornecedores.
-- Eles continuam existindo para compatibilidade com fornecedores antigos, mas deixam de ser obrigatorios.

do $$
begin
  if to_regclass('public.fornecedores') is null then
    raise exception 'A tabela public.fornecedores precisa existir antes desta migration.';
  end if;
end $$;

alter table public.fornecedores
  alter column unidade_codigo drop not null,
  alter column setor_codigo drop not null;

comment on column public.fornecedores.unidade_codigo is
  'Codigo da unidade associada ao fornecedor quando houver. Campo opcional.';
comment on column public.fornecedores.setor_codigo is
  'Codigo do centro de custo/setor associado ao fornecedor quando houver. Campo opcional.';
