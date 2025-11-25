import { ReactNode } from "react";
import { usePermissions, Module } from "@/hooks/usePermissions";

interface PermissionWrapperProps {
  module: Module;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wrapper that checks if user can view a module.
 * If not, shows fallback or nothing.
 */
export const PermissionWrapper = ({
  module,
  children,
  fallback,
}: PermissionWrapperProps) => {
  const { canView, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  if (!canView(module)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};
