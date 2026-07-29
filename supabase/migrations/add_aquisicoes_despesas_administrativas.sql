-- Adiciona novas contas analiticas ao subgrupo de despesas gerais e administrativas.
-- O trigger de public.plano_contas resolve automaticamente o parent_id pelo codigo.

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values
  (
    '03-06-043',
    U&'AQUISI\00C7\00C3O DE M\00C1QUINAS / APARELHOS / EQUIPAMENTOS',
    'Despesa',
    259
  ),
  (
    '03-06-044',
    U&'AQUISI\00C7\00C3O DE M\00D3VEIS E UTENS\00CDLIOS',
    'Despesa',
    260
  )
  
on conflict (codigo) do update
set
  descricao = excluded.descricao,
  natureza = excluded.natureza,
  ordem = excluded.ordem,
  ativo = true;

with mapeamentos(codigo_conta, codigo_linha_dre) as (
  values
    ('03-06-043', '03.01'),
    ('03-06-044', '03.01')
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
