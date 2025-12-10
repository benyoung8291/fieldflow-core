import { useCallback } from 'react';
import { useDataAccessLogger } from '@/contexts/DataAccessLoggerContext';

interface AccessDeniedParams {
  attemptedRoute: string;
  reason: string;
  redirectTo: string;
  userAccessInfo?: {
    isCustomer?: boolean;
    isWorker?: boolean;
    canAccessOffice?: boolean;
    canAccessWorker?: boolean;
    canAccessCustomerPortal?: boolean;
    module?: string;
    requiredPermission?: string;
  };
}

export function useLogAccessDenied() {
  const { logAccessDenied } = useDataAccessLogger();

  return useCallback((params: AccessDeniedParams) => {
    logAccessDenied({
      attempted_route: params.attemptedRoute,
      reason: params.reason,
      redirect_to: params.redirectTo,
      user_access_info: params.userAccessInfo,
    });
  }, [logAccessDenied]);
}
