-- Adiciona novas contas analiticas ao plano de contas.
-- O trigger de public.plano_contas resolve automaticamente o parent_id pelo codigo.

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('01-03-008', 'INSS', U&'Dedu\00E7\00E3o', 31),
  ('02-02-030', U&'DI\00C1RIA / ALIMENTA\00C7\00C3O', 'Custo', 68)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;
