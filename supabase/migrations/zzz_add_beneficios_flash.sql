-- Adiciona o beneficio Flash apos as views base de Beneficios.
-- Arquivo esperado na tela: CPF e Valor.


do $$
begin
  if to_regclass('public.registros_dados') is null then
    raise exception 'A tabela public.registros_dados precisa existir antes desta migration.';
  end if;

  if to_regclass('public.plano_contas') is null then
    raise exception 'A tabela public.plano_contas precisa existir antes desta migration.';
  end if;

  if to_regclass('public.unidades') is null then
    raise exception 'A tabela public.unidades precisa existir antes desta migration.';
  end if;

  if to_regclass('public.setor') is null then
    raise exception 'A tabela public.setor precisa existir antes desta migration.';
  end if;

  if to_regprocedure('public.trg_validar_beneficio_plano_conta()') is null then
    raise exception 'A funcao public.trg_validar_beneficio_plano_conta precisa existir antes desta migration.';
  end if;
end $$;

create table if not exists public.beneficios_flash (
  id uuid primary key default gen_random_uuid(),
  data_beneficio date not null,
  cpf text not null,
  nome text not null,
  unidade_codigo text null references public.unidades(codigo) on update cascade on delete restrict,
  setor_codigo text null references public.setor(codigo) on update cascade on delete restrict,
  plano_conta_id uuid not null references public.plano_contas(id) on update cascade on delete restrict,
  valor numeric(14,2) not null,
  arquivo_nome text null,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beneficios_flash_cpf_not_blank check (btrim(cpf) <> ''),
  constraint beneficios_flash_nome_not_blank check (btrim(nome) <> ''),
  constraint beneficios_flash_valor_check check (valor >= 0)
);

comment on table public.beneficios_flash is
  'Beneficios Flash importados por CPF para composicao da DRE.';
comment on column public.beneficios_flash.plano_conta_id is
  'Conta analitica escolhida na importacao. Esta conta define a linha da DRE.';

create index if not exists idx_beneficios_flash_data
  on public.beneficios_flash(data_beneficio desc);
create index if not exists idx_beneficios_flash_cpf
  on public.beneficios_flash(cpf);
create index if not exists idx_beneficios_flash_unidade
  on public.beneficios_flash(unidade_codigo);
create index if not exists idx_beneficios_flash_setor
  on public.beneficios_flash(setor_codigo);
create index if not exists idx_beneficios_flash_conta
  on public.beneficios_flash(plano_conta_id);

drop trigger if exists trg_beneficios_flash_updated_at on public.beneficios_flash;
create trigger trg_beneficios_flash_updated_at
before update on public.beneficios_flash
for each row execute function public.set_updated_at();

drop trigger if exists trg_beneficios_flash_plano_conta on public.beneficios_flash;
create trigger trg_beneficios_flash_plano_conta
before insert or update of plano_conta_id on public.beneficios_flash
for each row execute function public.trg_validar_beneficio_plano_conta();

alter table public.beneficios_flash enable row level security;

drop policy if exists "approved users can read beneficios_flash" on public.beneficios_flash;
create policy "approved users can read beneficios_flash"
on public.beneficios_flash
for select
to authenticated
using (public.is_approved_profile());

drop policy if exists "approved users can insert beneficios_flash" on public.beneficios_flash;
create policy "approved users can insert beneficios_flash"
on public.beneficios_flash
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_approved_profile()
);

drop policy if exists "admin and rh can update beneficios_flash" on public.beneficios_flash;
create policy "admin and rh can update beneficios_flash"
on public.beneficios_flash
for update
to authenticated
using (public.has_profile_role(array['admin', 'rh']))
with check (public.has_profile_role(array['admin', 'rh']));

drop policy if exists "admin and rh can delete beneficios_flash" on public.beneficios_flash;
create policy "admin and rh can delete beneficios_flash"
on public.beneficios_flash
for delete
to authenticated
using (public.has_profile_role(array['admin', 'rh']));

create or replace view public.vw_beneficios_plano_contas
with (security_invoker = on) as
select
  'combustivel'::text as tipo,
  'Combustivel'::text as tipo_label,
  b.id,
  b.data_beneficio,
  b.cpf,
  b.nome,
  b.unidade_codigo,
  u.unidade as unidade_nome,
  b.setor_codigo,
  s.setor as setor_nome,
  b.plano_conta_id,
  b.valor,
  b.arquivo_nome,
  b.created_by,
  b.created_at,
  b.updated_at,
  pc.conta_codigo,
  pc.conta_descricao,
  pc.conta_natureza,
  pc.subgrupo_id,
  pc.subgrupo_codigo,
  pc.subgrupo_descricao,
  pc.grupo_id,
  pc.grupo_codigo,
  pc.grupo_descricao,
  pc.caminho_codigo,
  pc.caminho_descricao,
  pc.conta_codigo || ' - ' || pc.conta_descricao as conta_analitica,
  pc.grupo_codigo || ' - ' || pc.grupo_descricao as grupo_conta,
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta,
  b.placa
from public.beneficios_combustivel b
left join public.unidades u
  on u.codigo = b.unidade_codigo
left join public.setor s
  on s.codigo = b.setor_codigo
join public.vw_plano_contas_relatorio pc
  on pc.conta_id = b.plano_conta_id

union all

select
  'agregamento'::text as tipo,
  'Agregamento'::text as tipo_label,
  b.id,
  b.data_beneficio,
  b.cpf,
  b.nome,
  b.unidade_codigo,
  u.unidade as unidade_nome,
  b.setor_codigo,
  s.setor as setor_nome,
  b.plano_conta_id,
  b.valor,
  b.arquivo_nome,
  b.created_by,
  b.created_at,
  b.updated_at,
  pc.conta_codigo,
  pc.conta_descricao,
  pc.conta_natureza,
  pc.subgrupo_id,
  pc.subgrupo_codigo,
  pc.subgrupo_descricao,
  pc.grupo_id,
  pc.grupo_codigo,
  pc.grupo_descricao,
  pc.caminho_codigo,
  pc.caminho_descricao,
  pc.conta_codigo || ' - ' || pc.conta_descricao as conta_analitica,
  pc.grupo_codigo || ' - ' || pc.grupo_descricao as grupo_conta,
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta,
  null::text as placa
from public.beneficios_agregamento b
left join public.unidades u
  on u.codigo = b.unidade_codigo
left join public.setor s
  on s.codigo = b.setor_codigo
join public.vw_plano_contas_relatorio pc
  on pc.conta_id = b.plano_conta_id

union all

select
  'flash'::text as tipo,
  'Flash'::text as tipo_label,
  b.id,
  b.data_beneficio,
  b.cpf,
  b.nome,
  b.unidade_codigo,
  u.unidade as unidade_nome,
  b.setor_codigo,
  s.setor as setor_nome,
  b.plano_conta_id,
  b.valor,
  b.arquivo_nome,
  b.created_by,
  b.created_at,
  b.updated_at,
  pc.conta_codigo,
  pc.conta_descricao,
  pc.conta_natureza,
  pc.subgrupo_id,
  pc.subgrupo_codigo,
  pc.subgrupo_descricao,
  pc.grupo_id,
  pc.grupo_codigo,
  pc.grupo_descricao,
  pc.caminho_codigo,
  pc.caminho_descricao,
  pc.conta_codigo || ' - ' || pc.conta_descricao as conta_analitica,
  pc.grupo_codigo || ' - ' || pc.grupo_descricao as grupo_conta,
  pc.subgrupo_codigo || ' - ' || pc.subgrupo_descricao as subgrupo_conta,
  null::text as placa
from public.beneficios_flash b
left join public.unidades u
  on u.codigo = b.unidade_codigo
left join public.setor s
  on s.codigo = b.setor_codigo
join public.vw_plano_contas_relatorio pc
  on pc.conta_id = b.plano_conta_id;

grant select, insert, update, delete on public.beneficios_flash to authenticated;
grant select on public.vw_beneficios_plano_contas to authenticated;
