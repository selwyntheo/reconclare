import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canAccessScreen, ROLE_PERMISSIONS } from '../../config/permissions';
import { RolePermissions } from '../../types/rbac';

interface ProtectedRouteProps {
  screen: keyof RolePermissions['screens'];
  children: React.ReactNode;
}

export default function ProtectedRoute({ screen, children }: ProtectedRouteProps) {
  const { role } = useAuth();
  const access = canAccessScreen(role, screen);

  if (!access.visible) {
    const defaultRoute = ROLE_PERMISSIONS[role].defaultRoute;
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
}
