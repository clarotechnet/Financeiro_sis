-- Mantem a view legada intacta e acrescenta a conta analitica para a listagem.
-- As permissoes e RLS continuam sendo aplicadas pelas relacoes de origem.

drop view if exists public.vw_lancamentos_pix_com_conta_analitica;

create view public.vw_lancamentos_pix_com_conta_analitica
with (security_invoker = on) as
select
  v.*,
  l.plano_conta_id,
  pc.codigo as conta_analitica_codigo,
  pc.descricao as conta_analitica_descricao,
  case
    when pc.id is null then null
    else pc.codigo || ' - ' || pc.descricao
  end as conta_analitica
from public.vw_lancamentos_pix v
join public.lancamentos_pix l on l.id = v.id
left join public.plano_contas pc on pc.id = l.plano_conta_id;

grant select on public.vw_lancamentos_pix_com_conta_analitica to authenticated;
