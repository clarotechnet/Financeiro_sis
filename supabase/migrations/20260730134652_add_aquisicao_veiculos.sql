-- Adiciona a conta analitica de aquisicao de veiculos e a vincula
-- as Despesas Administrativas da DRE.
-- O trigger de public.plano_contas resolve o parent_id pelo codigo.

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values (
  '03-06-045',
  U&'AQUISI\00C7\00C3O DE VE\00CDCULOS',
  'Despesa',
  261
)
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

insert into public.dre_linha_contas (dre_linha_id, plano_conta_id)
select
  dl.id,
  pc.id
from public.plano_contas pc
join public.dre_linhas dl
  on dl.codigo = '03.01'
where pc.codigo = '03-06-045'
  and pc.e_analitica = true
on conflict (plano_conta_id) do update
set dre_linha_id = excluded.dre_linha_id;
