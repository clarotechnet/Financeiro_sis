create table if not exists public.beneficios_flash_tipos (
  nome text primary key,
  ordem integer not null default 1000,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint beneficios_flash_tipos_nome_check check (
    char_length(nome) between 2 and 100
    and nome = btrim(regexp_replace(nome, '[[:space:]]+', ' ', 'g'))
    and lower(nome) <> 'flash (legado)'
  )
);

create unique index if not exists beneficios_flash_tipos_nome_lower_idx
  on public.beneficios_flash_tipos(lower(nome));
create index if not exists beneficios_flash_tipos_created_by_idx
  on public.beneficios_flash_tipos(created_by);

insert into public.beneficios_flash_tipos(nome, ordem) values
  ('Flash Hora Extra', 10),
  ('Flash Bonificação', 20),
  ('Flash Tec Consultivo', 30),
  ('Flash Gatilho', 40),
  ('Flash Ind de vendas', 50),
  ('Flash Produtividade', 60),
  ('Flash VT', 70),
  ('Flash VA', 80)
on conflict do nothing;

insert into public.beneficios_flash_tipos(nome)
select distinct tipo_beneficio from public.beneficios_flash where tipo_beneficio is not null
on conflict do nothing;

alter table public.beneficios_flash_tipos enable row level security;
revoke all on public.beneficios_flash_tipos from public, anon, authenticated;
grant select, insert on public.beneficios_flash_tipos to authenticated;

create policy "approved users can read flash benefit types"
on public.beneficios_flash_tipos for select to authenticated
using ((select public.is_approved_profile()));

create policy "admin and rh can create flash benefit types"
on public.beneficios_flash_tipos for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select public.has_profile_role(array['admin', 'rh']))
);

alter table public.beneficios_flash
  drop constraint if exists beneficios_flash_tipo_beneficio_check;
alter table public.beneficios_flash
  add constraint beneficios_flash_tipo_beneficio_fkey
  foreign key (tipo_beneficio) references public.beneficios_flash_tipos(nome)
  on update cascade on delete restrict;
create index if not exists idx_beneficios_flash_tipo_beneficio
  on public.beneficios_flash(tipo_beneficio);

comment on table public.beneficios_flash_tipos is 'Tipos de beneficio cadastrados exclusivamente para as importacoes Flash.';
notify pgrst, 'reload schema';
