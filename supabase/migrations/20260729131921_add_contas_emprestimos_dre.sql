-- Adiciona contas de emprestimos ao plano de contas e as vincula a DRE.
-- O trigger de public.plano_contas resolve automaticamente o parent_id pelo codigo.

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('01-04-000', '1.4 OUTRAS RECEITAS FINANCEIRAS', 'Receita', 254)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('01-04-001', U&'EMPR\00C9STIMO', 'Receita', 255)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('07-00-000', U&'7. DESPESAS COM EMPR\00C9STIMO', null, 256)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('07-01-000', U&'7.1 DESPESAS COM EMPR\00C9STIMO', U&'Dedu\00E7\00E3o', 257)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  ('07-01-001', U&'PAGAMENTO DE EMPR\00C9STIMO', U&'Dedu\00E7\00E3o', 258)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

with mapeamentos(codigo_conta, codigo_linha_dre) as (
  values
    ('01-04-001', '04.01'),
    ('07-01-001', '04.02')
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
