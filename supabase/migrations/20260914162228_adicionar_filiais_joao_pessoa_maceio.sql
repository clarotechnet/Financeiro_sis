insert into public.unidades (codigo, unidade, ativo)
values
  ('11', 'FILIAL 05 - JOÃO PESSOA', true),
  ('12', 'FILIAL 06 - MACEIO', true)
on conflict (codigo) do update
set
  unidade = excluded.unidade,
  ativo = true,
  updated_at = now();
