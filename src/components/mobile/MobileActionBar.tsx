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
    <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-md border-b border-border/50 p-3 flex items-center gap-2 shadow-sm">
      {primaryActions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant || "default"}
          size="default"
          onClick={action.onClick}
          className={`${action.className} h-10 rounded-xl mobile-tap font-medium`}
        >
          <span className="mr-2">{action.icon}</span>
          {action.label}
        </Button>
      ))}
      
      {menuActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="ml-auto h-10 w-10 rounded-xl border-border/50 mobile-tap"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-56 bg-popover/95 backdrop-blur-xl border-border/50 shadow-lg"
          >
            {menuActions.map((action, index) => (
              <DropdownMenuItem
                key={index}
                onClick={action.onClick}
                className={`${action.className} cursor-pointer py-3 text-base mobile-tap`}
              >
                <span className="mr-2">{action.icon}</span>
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
