-- Garante que a observacao informada em Solicitacao de Pagamento tenha onde ser salva.
-- O app usa o nome tecnico "descricao", mas a interface exibe esse campo como "Observacao".

do $$
begin
  if to_regclass('public.lancamentos_pix') is null then
    raise exception 'A tabela public.lancamentos_pix precisa existir antes desta migration.';
  end if;
end $$;

alter table public.lancamentos_pix
  add column if not exists descricao text null;

comment on column public.lancamentos_pix.descricao is
  'Observacao livre informada no lancamento de solicitacao de pagamento.';
