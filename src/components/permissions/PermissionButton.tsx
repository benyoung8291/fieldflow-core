import { ReactNode } from "react";
import { usePermissions, Module, Permission } from "@/hooks/usePermissions";
import { Button, ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PermissionButtonProps extends Omit<ButtonProps, "disabled"> {
  module: Module;
  permission: Permission;
  children: ReactNode;
  hideIfNoPermission?: boolean;
  tooltipMessage?: string;
}

export const PermissionButton = ({
  module,
  permission,
  children,
  hideIfNoPermission = false,
  tooltipMessage = "You don't have permission to perform this action",
  ...props
}: PermissionButtonProps) => {
  const { hasPermission } = usePermissions();

  const allowed = hasPermission(module, permission);

  if (hideIfNoPermission && !allowed) {
    return null;
  }

  if (!allowed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button disabled {...props}>
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <Button {...props}>{children}</Button>;
};
