-- Campos opcionais no Novo Lancamento de Solicitacao de Pagamento.
-- A tela nao exige mais chave_pix, cnpj_id, secao_custeio_id nem centro_custeio_id.

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
      and column_name = 'chave_pix'
  ) then
    alter table public.lancamentos_pix alter column chave_pix drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lancamentos_pix'
      and column_name = 'cnpj_id'
  ) then
    alter table public.lancamentos_pix alter column cnpj_id drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lancamentos_pix'
      and column_name = 'secao_custeio_id'
  ) then
    alter table public.lancamentos_pix alter column secao_custeio_id drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lancamentos_pix'
      and column_name = 'centro_custeio_id'
  ) then
    alter table public.lancamentos_pix alter column centro_custeio_id drop not null;
  end if;
end $$;
