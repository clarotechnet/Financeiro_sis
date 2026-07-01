-- Categoria deixou de ser obrigatoria no Novo Lancamento.
-- A classificacao contabil passa a vir de plano_conta_id / Conta Analitica.

do $$
begin
  if to_regclass('public.lancamentos_pix') is null then
    raise exception 'A tabela public.lancamentos_pix precisa existir antes desta migration.';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lancamentos_pix'
      and column_name = 'categoria_id'
  ) then
    alter table public.lancamentos_pix alter column categoria_id drop not null;
  end if;
end $$;
