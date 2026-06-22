import React, { useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { AuthContext, Profile } from '@/contexts/AuthContextCore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const profileRef = useRef<Profile | null>(null);
  const initializedRef = useRef(false);

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

  const getPasswordResetRedirectUrl = () => (
    `${window.location.origin}${window.location.pathname}#/redefinir-senha`
  );

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await externalSupabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar profile:', error);
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      console.error('Erro ao buscar profile:', err);
      return null;
    }
  }, []);

  const applyProfile = useCallback((userId: string, profileData: Profile | null) => {
    if (profileData) {
      setProfile(profileData);
      return;
    }

    setProfile(prev => (prev?.id === userId ? prev : null));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      const profileData = await fetchProfile(user.id);
      applyProfile(user.id, profileData);
    }
  }, [user?.id, fetchProfile, applyProfile]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;

    externalSupabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!active) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        fetchProfile(initialSession.user.id).then((profileData) => {
          if (!active) return;
          applyProfile(initialSession.user.id, profileData);
          initializedRef.current = true;
          setIsLoading(false);
        });
      } else {
        initializedRef.current = true;
        setIsLoading(false);
      }

      const { data } = externalSupabase.auth.onAuthStateChange((event, currentSession) => {
        if (!active || event === 'INITIAL_SESSION') return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (event === 'TOKEN_REFRESHED') return;

        if (currentSession?.user) {
          setTimeout(async () => {
            if (!active) return;
            const profileData = await fetchProfile(currentSession.user.id);
            if (!active) return;
            applyProfile(currentSession.user.id, profileData);
          }, 0);
        } else {
          setProfile(null);
        }
      });
      subscription = data.subscription;
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [fetchProfile, applyProfile]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const { data, error } = await externalSupabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      // Garante linha no profile (evita login bloqueado por ausência de profile)
      if (data?.user?.id) {
        await externalSupabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              email: data.user.email ?? email,
              display_name: displayName ?? null,
            },
            { onConflict: 'id' }
          );
      }

      return {
        ok: true,
        message: 'Cadastro realizado! Aguarde aprovação do administrador para acessar.',
      };
    } catch (error: unknown) {
      console.error('Erro no cadastro:', error);
      return {
        ok: false,
        message: getErrorMessage(error, 'Erro ao realizar cadastro'),
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await externalSupabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const userId = data.user.id;

      // Checa aprovação
      const { data: profileData, error: pErr } = await externalSupabase
        .from('profiles')
        .select('approved, role, display_name')
        .eq('id', userId)
        .maybeSingle();

      if (pErr) throw pErr;

      if (!profileData?.approved) {
        // Derruba a sessão e bloqueia
        await externalSupabase.auth.signOut();
        return {
          ok: false,
          reason: 'PENDENTE',
          message: 'Seu acesso ainda não foi aprovado. Aguarde a liberação do administrador.',
        };
      }

      return { ok: true, message: 'Login realizado com sucesso!' };
    } catch (error: unknown) {
      console.error('Erro no login:', error);
      return {
        ok: false,
        message: getErrorMessage(error, 'Erro ao realizar login'),
      };
    }
  };

  const signOut = async () => {
    await externalSupabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const { error } = await externalSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl(),
      });

      if (error) throw error;

      return {
        ok: true,
        message: 'Se esse e-mail estiver cadastrado, enviaremos um link para redefinir a senha.',
      };
    } catch (error: unknown) {
      console.error('Erro ao solicitar redefinição de senha:', error);
      return {
        ok: false,
        message: getErrorMessage(error, 'Não foi possível enviar o link de redefinição.'),
      };
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isApproved = profile?.approved ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isAdmin,
        isApproved,
        signUp,
        signIn,
        requestPasswordReset,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
