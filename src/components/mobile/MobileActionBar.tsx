import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MobileAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

interface MobileActionBarProps {
  primaryActions?: MobileAction[];
  menuActions?: MobileAction[];
}

export const MobileActionBar = ({
  primaryActions = [],
  menuActions = [],
}: MobileActionBarProps) => {
  return (
    <div className="sticky top-0 z-10 bg-background border-b p-3 flex items-center gap-2">
      {primaryActions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant || "default"}
          size="sm"
          onClick={action.onClick}
          className={action.className}
        >
          {action.icon}
          <span className="ml-2">{action.label}</span>
        </Button>
      ))}
      
      {menuActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menuActions.map((action, index) => (
              <DropdownMenuItem
                key={index}
                onClick={action.onClick}
                className={action.className}
              >
                {action.icon}
                <span className="ml-2">{action.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
