import { Link } from 'react-router-dom';
import { Clock3 } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { ROLE_RH } from '@/lib/profileRoles';

export default function FinancialApprovalNotice() {
  const { profile } = useAuth();
  if (profile?.role !== ROLE_RH) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <Clock3 className="h-4 w-4 shrink-0" />
      <span>Seus novos lançamentos e importações aguardam aprovação de um administrador antes de entrar nos resultados.</span>
      <Link className="font-semibold underline underline-offset-4" to="/aprovacoes">Meus envios</Link>
    </div>
  );
}
