import { useNavigate, useLocation } from "react-router-dom";
import { Home, Users, ClipboardList, FileText, Receipt, MoreHorizontal, Calendar, Briefcase, Building2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/contexts/ViewModeContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
import { useUserAccess } from "@/hooks/useUserAccess";
import { usePermissions } from "@/hooks/usePermissions";
import { getRouteModule } from "@/config/routePermissions";
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
}

const primaryNavItems: NavItem[] = [
  { icon: Home, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "CRM", path: "/crm-hub" },
  { icon: ClipboardList, label: "Orders", path: "/service-orders" },
  { icon: FileText, label: "Quotes", path: "/quotes" },
];

const moreNavItems: NavItem[] = [
  { icon: Receipt, label: "Invoices", path: "/invoices" },
  { icon: Calendar, label: "Scheduler", path: "/scheduler" },
  { icon: Briefcase, label: "Projects", path: "/projects" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: Users, label: "Workers", path: "/workers" },
  { icon: Calendar, label: "Appointments", path: "/appointments" },
  { icon: FileText, label: "Service Contracts", path: "/service-contracts" },
  { icon: Building2, label: "Suppliers", path: "/suppliers" },
  { icon: ShoppingCart, label: "Purchase Orders", path: "/purchase-orders" },
  { icon: Receipt, label: "Expenses", path: "/expenses" },
];

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useViewMode();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { data: access, isLoading } = useUserAccess();
  const { canView, isLoading: permissionsLoading } = usePermissions();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isMobile || !isAuthenticated) return null;
  if (location.pathname.startsWith('/worker') || location.pathname.startsWith('/customer') || location.pathname === '/auth') return null;
  
  // Wait for access check to complete to prevent flash of wrong menu
  if (isLoading || permissionsLoading) return null;
  
  // Only show for users with office access
  if (!access?.canAccessOffice) return null;
  if (location.pathname.startsWith('/settings') || location.pathname.startsWith('/helpdesk')) {
    return null;
  }

  // Filter nav items based on permissions
  const visiblePrimaryNav = useMemo(() => {
    return primaryNavItems.filter(item => {
      const module = getRouteModule(item.path);
      return !module || canView(module);
    });
  }, [canView]);

  const visibleMoreNav = useMemo(() => {
    return moreNavItems.filter(item => {
      const module = getRouteModule(item.path);
      return !module || canView(module);
    });
  }, [canView]);

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 shadow-xl pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {visiblePrimaryNav.map((item) => {
          const Icon = item.icon;
          const isActive = isActivePath(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all mobile-tap flex-1",
                isActive
                  ? "text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-transform",
                isActive && "scale-110"
              )} />
              <span className={cn(
                "text-[11px] font-medium",
                isActive && "font-semibold"
              )}>
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
          <SheetContent 
            side="bottom" 
            className="h-[70vh] bg-background/95 backdrop-blur-xl border-t-2 border-border/50 rounded-t-3xl"
          >
            <SheetHeader className="mb-6">
              <SheetTitle className="text-xl font-semibold">More Options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3 pb-6">
              {visibleMoreNav.map((item) => {
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
