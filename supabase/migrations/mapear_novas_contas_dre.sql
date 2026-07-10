-- Mapeia contas analiticas criadas depois da estrutura inicial da DRE.
-- As contas de Ativo 05-* ficam de fora de proposito, pois nao compoem DRE.

with mapeamentos(codigo_conta, codigo_linha_dre) as (
  values
    ('01-03-008', '01.02'), -- INSS: deducao da receita
    ('02-02-028', '02.01'), -- Fardamento: custo direto
    ('02-02-029', '02.01'), -- DSR: custo direto
    ('02-02-030', '02.01'), -- Diaria / Alimentacao: custo direto
    ('02-02-031', '02.01'), -- Agregamento: custo direto
    ('03-02-011', '03.02')  -- Salario maternidade administrativo: despesa com pessoal
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
on conflict (plano_conta_id) do nothing;
