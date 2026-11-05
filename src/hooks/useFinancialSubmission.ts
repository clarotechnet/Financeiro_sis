import { useCallback } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { externalSupabase } from '@/integrations/supabase/externalClient';
import { ROLE_RH } from '@/lib/profileRoles';
import type { FinancialSource } from '@/lib/financialApprovals';

export function useFinancialSubmission() {
  const { profile } = useAuth();
  const requiresApproval = profile?.role === ROLE_RH;
  const submitForApproval = useCallback(async (source: FinancialSource, records: Record<string, unknown>[], fileName?: string | null) => {
    if (records.length === 0) return 0;
    const { error } = await externalSupabase.rpc('submit_financial_approval', {
      p_source: source, p_records: records, p_file_name: fileName || null,
    });
    if (error) throw error;
    window.dispatchEvent(new Event('technet:notifications-refresh'));
    return records.length;
  }, []);
  return { requiresApproval, submitForApproval };
}
