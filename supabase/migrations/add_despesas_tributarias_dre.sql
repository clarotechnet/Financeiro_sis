-- Adiciona despesas tributarias sobre o lucro ao plano de contas.
-- O trigger de public.plano_contas resolve automaticamente o parent_id pelo codigo.
-- A DRE fica: Lucro Antes do IRPJ e CSLL, IRPJ, CSLL e Lucro Liquido.

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('06-00-000', U&'6. DESPESAS TRIBUR\00C1RIAS', null, 250)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('06-01-000', U&'6.1 DESPESAS TRIBUR\00C1RIAS SOBRE O LUCRO', U&'Dedu\00E7\00E3o', 251)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('06-01-001', 'IRPJ', U&'Dedu\00E7\00E3o', 252),
  ('06-01-002', 'CSLL', U&'Dedu\00E7\00E3o', 253)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

insert into public.dre_linhas (codigo, descricao, ordem, nivel, tipo, sinal, ativo, exibir_pdf)
values
  ('04.97', U&'Lucro Antes do IRPJ e CSLL', 145, 2, 'subtotal', 1, true, true),
  ('04.98', 'IRPJ - Corrente e Diferido (se houver)', 146, 2, 'contas', 1, true, true),
  ('04.99', 'CSLL - Corrente e Diferido (se houver)', 147, 2, 'contas', 1, true, true),
  ('04.100', U&'Lucro L\00EDquido', 150, 2, 'resultado', 1, true, true)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  ordem = excluded.ordem,
  nivel = excluded.nivel,
  tipo = excluded.tipo,
  sinal = excluded.sinal,
  ativo = excluded.ativo,
  exibir_pdf = excluded.exibir_pdf;

with mapeamentos(codigo_conta, codigo_linha_dre) as (
  values
    ('06-01-001', '04.98'),
    ('06-01-002', '04.99')
)
insert into public.dre_linha_contas (dre_linha_id, plano_conta_id)
select
  dl.id,
  pc.id
from mapeamentos m
join public.plano_contas pc
  on pc.codigo = m.codigo_conta
join public.dre_linhas dl
  on dl.codigo = m.codigo_linha_dre
where pc.e_analitica = true
on conflict (plano_conta_id) do update
set dre_linha_id = excluded.dre_linha_id;
