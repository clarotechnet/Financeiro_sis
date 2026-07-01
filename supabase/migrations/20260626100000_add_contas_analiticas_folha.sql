-- Novas contas analiticas solicitadas para classificacao da folha.
-- O trigger de plano_contas resolve automaticamente o parent_id pelo codigo.

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('02-02-028', 'FARDAMENTO', 'Custo', 66),
  ('02-02-029', 'DSR', 'Custo', 67),
  ('03-02-011', 'SALÁRIO MATERNIDADE', 'Despesa', 118)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;
