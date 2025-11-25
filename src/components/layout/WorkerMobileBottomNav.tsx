import { useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, Clock, MoreHorizontal, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Don't show when not authenticated
  if (!isAuthenticated) return null;

  // Only show on worker app routes (not on auth page)
  if (!location.pathname.startsWith('/worker') || location.pathname === '/auth') return null;

  const isActivePath = (path: string) => location.pathname === path;

  // Add badge to tasks nav item
  const navItemsWithBadge = primaryNavItems.map(item => 
    item.path === "/worker/tasks" ? { ...item, badge: openTasksCount } : item
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 shadow-xl pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItemsWithBadge.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all mobile-tap flex-1",
                isActive
                  ? "text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn("text-[11px] font-medium", isActive && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
        
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all mobile-tap flex-1 text-muted-foreground hover:text-foreground hover:bg-muted/50">
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[11px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] bg-background/95 backdrop-blur-xl border-t-2 border-border/50 rounded-t-3xl">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-xl font-semibold">More Options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 pb-6">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.path);
                
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex flex-col items-center justify-center h-24 gap-2 rounded-2xl mobile-tap",
                      isActive
                        ? "text-primary bg-primary/10 border-2 border-primary/20"
                        : "text-foreground hover:bg-muted/80"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
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
