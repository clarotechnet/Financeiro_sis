import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getPasswordRecoveryRedirect } from '@/lib/passwordRecovery';

export default function PasswordRecoveryRedirect({ children }: { children: ReactNode }) {
  const location = useLocation();
  const redirect = getPasswordRecoveryRedirect(location);

  if (redirect) return <Navigate to={redirect} replace />;

  return <>{children}</>;
}
