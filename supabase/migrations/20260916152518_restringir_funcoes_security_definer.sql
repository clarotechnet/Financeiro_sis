-- Remove a chamada anonima de funcoes SECURITY DEFINER sem alterar seu uso
-- por triggers e politicas RLS. Triggers executam pela vinculacao no banco e
-- nao precisam de permissao EXECUTE concedida ao usuario da aplicacao.

revoke execute on function public.bloquear_assistente_financeiro_cadastros() from public, anon;
revoke execute on function public.bloquear_assistente_financeiro_update_delete() from public, anon;
revoke execute on function public.current_user_is_approved_admin() from public, anon;
revoke execute on function public.fn_dados_financeiro_resolve_registro() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.has_profile_role(text[]) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
revoke execute on function public.is_approved_profile() from public, anon;
revoke execute on function public.is_assistente_financeiro() from public, anon;
revoke execute on function public.proteger_profiles_campos_sensiveis() from public, anon;
revoke execute on function public.remove_pending_on_profile_approval() from public, anon;
revoke execute on function public.sync_pending_approval() from public, anon;

-- Funcoes internas: chamadas apenas por triggers ou por outras funcoes do banco.
revoke execute on function public.bloquear_assistente_financeiro_cadastros() from authenticated;
revoke execute on function public.bloquear_assistente_financeiro_update_delete() from authenticated;
revoke execute on function public.current_user_is_approved_admin() from authenticated;
revoke execute on function public.fn_dados_financeiro_resolve_registro() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.is_assistente_financeiro() from authenticated;
revoke execute on function public.proteger_profiles_campos_sensiveis() from authenticated;
revoke execute on function public.remove_pending_on_profile_approval() from authenticated;
revoke execute on function public.sync_pending_approval() from authenticated;

-- Funcoes chamadas pelas policies RLS: continuam disponiveis somente apos login.
grant execute on function public.has_profile_role(text[]) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_approved_profile() to authenticated;
