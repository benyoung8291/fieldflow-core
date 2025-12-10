import { Navigate, useLocation } from "react-router-dom";
import { useWorkerRole } from "@/hooks/useWorkerRole";
import { Loader2 } from "lucide-react";
import { useLogAccessDenied } from "@/hooks/useLogAccessDenied";

interface SupervisorProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Wraps routes to enforce supervisor-level access.
 * Redirects workers without supervisor role to worker dashboard.
 */
export const SupervisorProtectedRoute = ({ 
  children 
}: SupervisorProtectedRouteProps) => {
  const { isSupervisorOrAbove, isLoading } = useWorkerRole();
  const location = useLocation();
  const logAccessDenied = useLogAccessDenied();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSupervisorOrAbove) {
    logAccessDenied({
      attemptedRoute: location.pathname,
      reason: 'supervisor_role_required',
      redirectTo: '/worker/dashboard',
    });
    return <Navigate to="/worker/dashboard" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
