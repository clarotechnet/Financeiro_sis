-- Armazena comprovantes de pagamento em bucket privado.
-- O banco guarda somente o caminho e o nome original; o PDF fica no Storage.

alter table public.lancamentos_pix
  add column if not exists comprovante_path text,
  add column if not exists comprovante_nome text;

comment on column public.lancamentos_pix.comprovante_path is
  'Caminho privado do PDF no bucket comprovantes-pagamentos.';
comment on column public.lancamentos_pix.comprovante_nome is
  'Nome original do PDF informado pelo usuario.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'comprovantes-pagamentos',
  'comprovantes-pagamentos',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "approved users can read payment receipts" on storage.objects;
create policy "approved users can read payment receipts"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'comprovantes-pagamentos'
  and public.is_approved_profile()
);

drop policy if exists "approved users can upload own payment receipts" on storage.objects;
create policy "approved users can upload own payment receipts"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'comprovantes-pagamentos'
  and public.is_approved_profile()
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "admin and rh can delete payment receipts" on storage.objects;
create policy "admin and rh can delete payment receipts"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'comprovantes-pagamentos'
  and public.has_profile_role(array['admin', 'rh'])
);

create or replace view public.vw_lancamentos_pix_com_conta_analitica
with (security_invoker = on) as
select
  v.id,
  v.data_lancamento,
  v.nome,
  v.chave_pix,
  v.favorecido,
  v.descricao,
  v.valor,
  v.cnpj_id,
  v.cnpj,
  v.unidade_id,
  v.unidade,
  v.centro_de_custo_id,
  v.centro_de_custo,
  v.categoria_id,
  v.categoria,
  v.secao_custeio_id,
  v.secao_custeio,
  v.centro_custeio_id,
  v.centro_custeio,
  v.banco,
  v.forma_pagamento,
  v.status_pag,
  v.created_by,
  v.created_at,
  v.updated_at,
  l.plano_conta_id,
  l.unidade_codigo,
  u.unidade as unidade_cadastro,
  l.setor_codigo,
  st.setor as setor_nome,
  pc.codigo as conta_analitica_codigo,
  pc.descricao as conta_analitica_descricao,
  case
    when pc.id is null then null
    else pc.codigo || ' - ' || pc.descricao
  end as conta_analitica,
  l.banco_codigo,
  b.banco as banco_cadastro,
  l.rateio_lote_id,
  l.rateio_item_ordem,
  l.parcela_numero,
  l.parcela_total,
  l.comprovante_path,
  l.comprovante_nome
from public.vw_lancamentos_pix v
join public.lancamentos_pix l on l.id = v.id
left join public.unidades u on u.codigo = l.unidade_codigo
left join public.setor st on st.codigo = l.setor_codigo
left join public.plano_contas pc on pc.id = l.plano_conta_id
left join public.bancos b on b.codigo = l.banco_codigo;

grant select on public.vw_lancamentos_pix_com_conta_analitica to authenticated;
