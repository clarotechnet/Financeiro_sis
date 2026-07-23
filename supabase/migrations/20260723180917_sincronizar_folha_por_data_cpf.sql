-- Garante uma unica linha de folha por colaborador em cada data.
-- A importacao usa esta chave para atualizar todas as verbas quando
-- a mesma folha for enviada novamente.

do $$
begin
  if to_regclass('public.dados_financeiro') is null then
    raise exception 'A tabela public.dados_financeiro precisa existir antes desta migration.';
  end if;
end $$;

-- Mantem o CPF no mesmo formato usado pelo importador e pelo trigger existente.
update public.dados_financeiro
set cpf = regexp_replace(cpf, '\D', '', 'g')
where cpf is not null
  and cpf is distinct from regexp_replace(cpf, '\D', '', 'g');

-- Em bases que ja tenham repeticoes, conserva a linha alterada mais recentemente.
with duplicados as (
  select
    id,
    row_number() over (
      partition by data, cpf
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as ordem
  from public.dados_financeiro
  where cpf is not null
)
delete from public.dados_financeiro df
using duplicados d
where df.id = d.id
  and d.ordem > 1;

create unique index if not exists uq_dados_financeiro_data_cpf
  on public.dados_financeiro (data, cpf);

comment on index public.uq_dados_financeiro_data_cpf is
  'Impede duplicidade de colaborador na mesma data e permite sincronizacao da folha por upsert.';
