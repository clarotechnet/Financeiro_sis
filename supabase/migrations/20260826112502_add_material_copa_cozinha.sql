-- Adiciona a conta analitica de material de copa e cozinha e a vincula
-- as Despesas Administrativas da DRE.
-- O trigger de public.plano_contas resolve o parent_id pelo codigo.

insert into public.plano_contas (codigo, descricao, natureza, ordem)
values (
  '03-06-046',
  'MATERIAL DE COPA E COZINHA',
  'Despesa',
  262
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
where pc.codigo = '03-06-046'
  and pc.e_analitica = true
on conflict (plano_conta_id) do update
set dre_linha_id = excluded.dre_linha_id;

do $$
begin
  if not exists (
    select 1
    from public.plano_contas pc
    join public.dre_linha_contas dlc
      on dlc.plano_conta_id = pc.id
    join public.dre_linhas dl
      on dl.id = dlc.dre_linha_id
    where pc.codigo = '03-06-046'
      and pc.e_analitica = true
      and pc.ativo = true
      and dl.codigo = '03.01'
  ) then
    raise exception 'Nao foi possivel vincular a conta 03-06-046 a linha 03.01 da DRE.';
  end if;
end;
$$;
