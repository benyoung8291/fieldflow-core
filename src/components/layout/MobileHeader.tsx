import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewModeToggle } from "@/components/layout/ViewModeToggle";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { IssueReportDialog } from "@/components/common/IssueReportDialog";
import { TeamPresence } from "@/components/common/TeamPresence";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const MobileHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary-hover shadow-sm flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">SP</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1">
          <TeamPresence />
          <IssueReportDialog />
          <ViewModeToggle />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-xl touch-target hover:bg-muted/80 transition-colors"
              >
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-48 bg-popover/95 backdrop-blur-xl border-border/50 shadow-lg"
            >
              <DropdownMenuItem 
                onClick={() => navigate("/settings")}
                className="cursor-pointer py-3 text-base"
              >
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/auth");
                  toast.success("Signed out successfully");
                }}
                className="cursor-pointer py-3 text-base text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
