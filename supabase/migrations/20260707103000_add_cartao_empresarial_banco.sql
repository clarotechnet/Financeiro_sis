-- Adiciona a opcao de cartao empresarial/corporativo ao cadastro mestre de bancos.

update public.bancos
set
  ativo = true,
  updated_at = now()
where upper(btrim(banco)) = upper(btrim(U&'Cart\00E3o empresarial / corporativo'));

insert into public.bancos (codigo, banco)
select 'B009', U&'Cart\00E3o empresarial / corporativo'
where not exists (
  select 1
  from public.bancos
  where upper(btrim(banco)) = upper(btrim(U&'Cart\00E3o empresarial / corporativo'))
)
on conflict (codigo) do update
set
  banco = excluded.banco,
  ativo = true,
  updated_at = now();
