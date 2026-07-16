-- Centro de custo usado em lancamentos, receitas e cadastros de colaboradores.

insert into public.setor (codigo, setor)
values ('S031', 'Estoque')
on conflict (codigo) do update
set
  setor = excluded.setor,
  ativo = true,
  updated_at = now();
