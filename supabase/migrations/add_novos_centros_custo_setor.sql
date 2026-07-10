-- Novos centros de custo usados nas telas de lancamentos, receitas e departamento pessoal.

insert into public.setor (codigo, setor)
values
  ('S023', 'Técnica — Gestão'),
  ('S024', 'Comercial Gestão'),
  ('S025', 'Comercial MDU'),
  ('S026', 'Comercial BKO'),
  ('S027', 'Segurança do Trabalho - SST'),
  ('S028', 'Suporte Sistema'),
  ('S029', 'Afastamento Comercial'),
  ('S030', 'Afastamento Técnica')
on conflict (codigo) do update
set
  setor = excluded.setor,
  ativo = true,
  updated_at = now();
