import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, requireAdmin = false, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isAdmin, isApproved, profile } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Não está logado
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Não está aprovado
  if (!isApproved) {
    return <Navigate to="/login" replace />;
  }

  // Requer admin mas não é admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(profile?.role ?? '')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}


