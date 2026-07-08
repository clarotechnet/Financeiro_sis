import { useCallback, useEffect, useMemo, useState } from 'react';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { useAuth } from '@/contexts/useAuth';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  count: number;
  href: string;
  since?: string;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getDefaultSince = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export function useNotifications() {
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingSeen, setIsMarkingSeen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastSeenAt = profile?.notifications_seen_at || null;

  const refresh = useCallback(async () => {
    if (!user?.id || !profile?.approved) {
      setItems([]);
      setError(null);
      return;
    }

    const since = lastSeenAt || getDefaultSince();
    const errors: string[] = [];

    const safeCount = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
      try {
        const { count, error: countError } = await query;
        if (countError) {
          errors.push(getErrorMessage(countError, 'Erro ao carregar notificações.'));
          return 0;
        }
        return count || 0;
      } catch (countError) {
        errors.push(getErrorMessage(countError, 'Erro ao carregar notificações.'));
        return 0;
      }
    };

    setIsLoading(true);
    try {
      const [paymentCount, payrollCount, pendingProfilesCount] = await Promise.all([
        safeCount(
          externalSupabase
            .from('lancamentos_pix')
            .select('id', { count: 'exact', head: true })
            .gt('created_at', since)
        ),
        safeCount(
          externalSupabase
            .from('dados_financeiro')
            .select('id', { count: 'exact', head: true })
            .gt('created_at', since)
        ),
        isAdmin
          ? safeCount(
              externalSupabase
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .eq('approved', false)
            )
          : Promise.resolve(0),
      ]);

      const nextItems: NotificationItem[] = [];

      if (paymentCount > 0) {
        nextItems.push({
          id: 'payment-requests',
          title: 'Solicitação de pagamento',
          description: `${paymentCount} novo(s) lançamento(s) desde a última visualização.`,
          count: paymentCount,
          href: `/comissionamento?tab=table&notificacaoDesde=${encodeURIComponent(since)}`,
          since,
        });
      }

      if (payrollCount > 0) {
        nextItems.push({
          id: 'payroll',
          title: 'Folha de pagamento',
          description: `${payrollCount} novo(s) registro(s) de folha desde a última visualização.`,
          count: payrollCount,
          href: '/folha-pagamento',
        });
      }

      if (pendingProfilesCount > 0) {
        nextItems.push({
          id: 'pending-profiles',
          title: 'Perfis pendentes',
          description: `${pendingProfilesCount} usuário(s) aguardando aprovação.`,
          count: pendingProfilesCount,
          href: '/configuracoes',
        });
      }

      setItems(nextItems);
      setError(errors[0] || null);
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar as notificações.'));
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, lastSeenAt, profile?.approved, user?.id]);

  useEffect(() => {
    refresh();

    const intervalId = window.setInterval(refresh, 60_000);
    const handleRefresh = () => refresh();

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('technet:notifications-refresh', handleRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('technet:notifications-refresh', handleRefresh);
    };
  }, [refresh]);

  const markAsSeen = useCallback(async () => {
    if (!user?.id) return;

    setIsMarkingSeen(true);
    try {
      const { error: updateError } = await externalSupabase
        .from('profiles')
        .update({ notifications_seen_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setItems([]);
      await refreshProfile();
      window.dispatchEvent(new Event('technet:notifications-refresh'));
    } finally {
      setIsMarkingSeen(false);
    }
  }, [refreshProfile, user?.id]);

  const totalUnread = useMemo(
    () => items.reduce((total, item) => total + item.count, 0),
    [items]
  );

  return {
    items,
    totalUnread,
    isLoading,
    isMarkingSeen,
    error,
    lastSeenAt,
    refresh,
    markAsSeen,
  };
}
