-- Adiciona nova conta analitica ao plano de contas.
-- O trigger de public.plano_contas resolve automaticamente o parent_id pelo codigo.

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('02-02-031', 'AGREGAMENTO', 'Custo', 69)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;
