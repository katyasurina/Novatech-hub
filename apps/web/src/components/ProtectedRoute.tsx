import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Require the ADMIN role for the admin section. */
  admin?: boolean;
}

/**
 * Route guard. Anonymous users bounce to /login (remembering where they were,
 * so login can send them back); non-admins bounce to the home page.
 */
export function ProtectedRoute({ children, admin = false }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (admin && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}