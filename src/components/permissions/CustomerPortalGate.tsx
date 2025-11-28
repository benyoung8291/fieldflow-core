import { ReactNode } from "react";
import { useCustomerPortalPermissions, CustomerPortalPermission } from "@/hooks/useCustomerPortalPermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

interface CustomerPortalGateProps {
  permission: CustomerPortalPermission;
  children: ReactNode;
  fallback?: ReactNode;
  showAlert?: boolean;
}

/**
 * Gate component that checks customer portal user permissions
 * Blocks access based on portal role (basic, supervisor, full_access)
 */
export const CustomerPortalGate = ({
  permission,
  children,
  fallback,
  showAlert = false,
}: CustomerPortalGateProps) => {
  const { hasPermission, isLoading } = useCustomerPortalPermissions();

  if (isLoading) {
    return null;
  }

  if (!hasPermission(permission)) {
    if (showAlert) {
      return (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this feature. Contact your administrator for access.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

interface MultiPermissionCustomerPortalGateProps {
  permissions: CustomerPortalPermission[];
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Gate component that checks multiple customer portal permissions
 */
export const MultiPermissionCustomerPortalGate = ({
  permissions,
  requireAll = false,
  children,
  fallback,
}: MultiPermissionCustomerPortalGateProps) => {
  const { hasPermission, isLoading } = useCustomerPortalPermissions();

  if (isLoading) {
    return null;
  }

  const hasAccess = requireAll
    ? permissions.every((p) => hasPermission(p))
    : permissions.some((p) => hasPermission(p));

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};
