-- Preenche a numeracao dos lancamentos mensais criados antes de o frontend
-- passar a enviar parcela_numero e parcela_total.
--
-- Um grupo so e atualizado quando:
-- 1. todos os dados financeiros e o instante de criacao sao iguais;
-- 2. existem de 2 a 60 registros;
-- 3. cada registro ocupa exatamente o mes seguinte, preservando o dia;
-- 4. nenhuma parcela do grupo ja possui numeracao.

with base as (
  select
    l.*,
    jsonb_build_array(
      l.created_at,
      l.nome,
      l.favorecido,
      l.chave_pix,
      l.descricao,
      l.valor,
      l.unidade_codigo,
      l.setor_codigo,
      l.plano_conta_id,
      l.banco_codigo,
      l.status_pag,
      l.rateio_item_ordem
    ) as grupo_chave
  from public.lancamentos_pix l
  where l.parcela_numero is null
    and l.parcela_total is null
),
ordenados as (
  select
    b.*,
    row_number() over (
      partition by b.grupo_chave
      order by b.data_lancamento, b.id
    ) as numero_parcela,
    count(*) over (
      partition by b.grupo_chave
    ) as total_parcelas,
    min(b.data_lancamento) over (
      partition by b.grupo_chave
    ) as primeira_data
  from base b
),
validados as (
  select
    o.*,
    (
      date_trunc('month', o.primeira_data)::date
      + ((o.numero_parcela - 1)::text || ' months')::interval
      + (
          least(
            extract(day from o.primeira_data)::integer,
            extract(day from (
              date_trunc('month', o.primeira_data)::date
              + (o.numero_parcela::text || ' months')::interval
              - interval '1 day'
            ))::integer
          ) - 1
        ) * interval '1 day'
    )::date as data_esperada
  from ordenados o
  where o.total_parcelas between 2 and 60
),
grupos_validos as (
  select v.grupo_chave
  from validados v
  group by v.grupo_chave
  having bool_and(v.data_lancamento = v.data_esperada)
    and count(distinct v.data_lancamento) = count(*)
),
parcelas as (
  select
    v.id,
    v.numero_parcela::integer as parcela_numero,
    v.total_parcelas::integer as parcela_total
  from validados v
  join grupos_validos g using (grupo_chave)
)
update public.lancamentos_pix l
set
  parcela_numero = p.parcela_numero,
  parcela_total = p.parcela_total
from parcelas p
where l.id = p.id
  and l.parcela_numero is null
  and l.parcela_total is null;
