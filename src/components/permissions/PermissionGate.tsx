import { ReactNode } from "react";
import { usePermissions, Module, Permission } from "@/hooks/usePermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

interface PermissionGateProps {
  module: Module;
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
  showAlert?: boolean;
}

export const PermissionGate = ({
  module,
  permission,
  children,
  fallback,
  showAlert = false,
}: PermissionGateProps) => {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  if (!hasPermission(module, permission)) {
    if (showAlert) {
      return (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this feature.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

interface MultiPermissionGateProps {
  module: Module;
  permissions: Permission[];
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export const MultiPermissionGate = ({
  module,
  permissions,
  requireAll = false,
  children,
  fallback,
}: MultiPermissionGateProps) => {
  const { hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const hasAccess = requireAll 
    ? hasAllPermissions(module, permissions)
    : hasAnyPermission(module, permissions);

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};
