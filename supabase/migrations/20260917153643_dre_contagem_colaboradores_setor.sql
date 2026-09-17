-- Entrega somente totais agregados para o rateio da DRE, sem expor CPFs no navegador.
create or replace function public.contar_colaboradores_por_setor()
returns table (
  setor_codigo text,
  colaboradores bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with cadastros_mais_recentes as (
    select
      regexp_replace(coalesce(rd.cpf, ''), '\D', '', 'g') as cpf_normalizado,
      rd.setor_codigo,
      row_number() over (
        partition by regexp_replace(coalesce(rd.cpf, ''), '\D', '', 'g')
        order by rd.id desc
      ) as ordem
    from public.registros_dados rd
    where length(regexp_replace(coalesce(rd.cpf, ''), '\D', '', 'g')) = 11
  )
  select
    cadastro.setor_codigo,
    count(*)::bigint as colaboradores
  from cadastros_mais_recentes cadastro
  where cadastro.ordem = 1
    and cadastro.setor_codigo is not null
  group by cadastro.setor_codigo
  order by cadastro.setor_codigo;
$function$;

comment on function public.contar_colaboradores_por_setor() is
  'Conta CPFs distintos pelo setor mais recente para os rateios gerenciais da DRE.';

revoke all on function public.contar_colaboradores_por_setor() from public;
revoke all on function public.contar_colaboradores_por_setor() from anon;
grant execute on function public.contar_colaboradores_por_setor() to authenticated;
