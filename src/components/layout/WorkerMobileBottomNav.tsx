import { useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, Clock, MoreHorizontal, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface NavItem {
  icon: typeof Home;
  label: string;
  path: string;
  badge?: number;
}

const primaryNavItems: NavItem[] = [
  { icon: Home, label: "Home", path: "/worker/dashboard" },
  { icon: Calendar, label: "Appointments", path: "/worker/appointments" },
  { icon: FileText, label: "Tasks", path: "/worker/tasks" },
];

const moreNavItems: NavItem[] = [
  { icon: Calendar, label: "Calendar", path: "/worker/calendar" },
  { icon: Clock, label: "Time Logs", path: "/worker/time-logs" },
  { icon: User, label: "Profile", path: "/worker/profile" },
];

export const WorkerMobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useViewMode();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: openTasksCount = 0 } = useQuery({
    queryKey: ["open-tasks-count", currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return 0;
      
      const { count, error } = await supabase
        .from("tasks")
        .select("*", { count: 'exact', head: true })
        .eq("assigned_to", currentUser.id)
        .neq("status", "completed");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentUser?.id,
  });

  // Only show on mobile devices
  if (!isMobile) return null;

  // Only show on worker app routes
  if (!location.pathname.startsWith('/worker')) return null;

  const isActivePath = (path: string) => location.pathname === path;

  // Add badge to tasks nav item
  const navItemsWithBadge = primaryNavItems.map(item => 
    item.path === "/worker/tasks" ? { ...item, badge: openTasksCount } : item
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border shadow-lg pb-safe">
      <div className="flex items-center justify-around h-14 px-4 safe-padding-x">
        {navItemsWithBadge.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-md transition-colors flex-1 min-w-0 relative",
                isActive
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 text-[9px]"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </button>
          );
        })}
        
        {/* More menu */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-md transition-colors flex-1 min-w-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[50vh] bg-sidebar">
            <SheetHeader>
              <SheetTitle className="text-sidebar-foreground">More Options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-4 mt-6">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.path);
                
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex flex-col items-center justify-center h-20 gap-2",
                      isActive
                        ? "text-sidebar-primary bg-sidebar-accent"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};
