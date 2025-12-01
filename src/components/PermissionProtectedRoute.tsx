import { Navigate, useLocation } from "react-router-dom";
import { usePermissions, Module } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

interface PermissionProtectedRouteProps {
  module: Module | null;
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

/**
 * Wraps routes to enforce module-level permissions.
 * Redirects to access denied page if user lacks required permissions.
 */
export const PermissionProtectedRoute = ({ 
  module, 
  children,
  requireSuperAdmin = false 
}: PermissionProtectedRouteProps) => {
  const { canView, isAdmin, isLoading } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Check super admin requirement
  if (requireSuperAdmin && !isAdmin) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  // Check module permission
  if (module && !canView(module)) {
    return <Navigate to="/access-denied" state={{ from: location, module }} replace />;
  }

  return <>{children}</>;
};
