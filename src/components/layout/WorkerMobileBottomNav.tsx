import { useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, Clock, MoreHorizontal, FileText, User, CalendarClock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useUnreadMessages } from "@/hooks/chat/useUnreadMessages";
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
  { icon: MessageSquare, label: "Chat", path: "/chat" },
];

const moreNavItems: NavItem[] = [
  { icon: CalendarClock, label: "Availability", path: "/worker/calendar" },
  { icon: Clock, label: "Time Logs", path: "/worker/time-logs" },
  { icon: FileText, label: "Field Report", path: "/worker/field-report-new" },
  { icon: User, label: "Profile", path: "/worker/profile" },
];

export const WorkerMobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useViewMode();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const { data: access, isLoading } = useUserAccess();

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

  const { data: unreadData } = useUnreadMessages();
  const chatUnreadCount = unreadData?.totalUnread || 0;

  // Only show on mobile devices
  if (!isMobile) return null;

  // Don't show when not authenticated
  if (!isAuthenticated) return null;

  // Only show on worker app routes (not on auth page)
  if (!location.pathname.startsWith('/worker') || location.pathname === '/auth') return null;

  // Wait for access check to complete to prevent flash of wrong menu
  if (isLoading) return null;
  
  // Only show for users with worker access
  if (!access?.canAccessWorker) return null;

  const isActivePath = (path: string) => location.pathname === path;

  // Add badges to nav items
  const navItemsWithBadge = primaryNavItems.map(item => {
    if (item.path === "/worker/tasks") return { ...item, badge: openTasksCount };
    if (item.path === "/chat") return { ...item, badge: chatUnreadCount };
    return item;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/98 backdrop-blur-2xl border-t border-border/40 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.3)] pb-safe">
      <div className="flex items-center justify-around h-20 px-4">
        {navItemsWithBadge.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl transition-all mobile-tap flex-1 touch-manipulation",
                isActive
                  ? "text-primary scale-105"
                  : "text-muted-foreground active:text-foreground active:scale-95"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-6 w-6 transition-transform", isActive && "scale-110")} strokeWidth={isActive ? 2.5 : 2} />
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] font-bold shadow-sm"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </div>
              <span className={cn("text-[11px] transition-all", isActive ? "font-bold" : "font-medium")}>
                {item.label}
              </span>
            </button>
          );
        })}
        
        <Sheet open={isMoreMenuOpen} onOpenChange={setIsMoreMenuOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl transition-all mobile-tap flex-1 text-muted-foreground active:text-foreground active:scale-95 touch-manipulation">
              <MoreHorizontal className="h-6 w-6" strokeWidth={2} />
              <span className="text-[11px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[60vh] bg-background backdrop-blur-2xl border-t-2 border-border/40 rounded-t-[32px] shadow-[0_-8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.4)] z-[100]">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-2xl font-bold">More Options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-4 pb-8 overflow-y-auto max-h-[calc(60vh-100px)]">
              {moreNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.path);
                
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    onClick={() => {
                      navigate(item.path);
                      setIsMoreMenuOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center h-32 gap-3 rounded-3xl mobile-tap p-4",
                      isActive
                        ? "text-primary bg-primary/10 border-2 border-primary/30 shadow-sm"
                        : "text-foreground hover:bg-muted/50 active:scale-95 border border-border/50"
                    )}
                  >
                    <div className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center",
                      isActive ? "bg-primary/20" : "bg-muted/50"
                    )}>
                      <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={cn("text-sm text-center leading-tight", isActive ? "font-bold" : "font-medium")}>{item.label}</span>
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
