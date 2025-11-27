import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, MapPin, FileText, LogOut, ClipboardList, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerPortalLayoutProps {
  children: ReactNode;
}

export function CustomerPortalLayout({ children }: CustomerPortalLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      navigate("/");
    }
  };

  const navItems = [
    { path: "/customer", icon: Home, label: "Dashboard" },
    { path: "/customer/locations", icon: MapPin, label: "Locations" },
    { path: "/customer/requests", icon: FileText, label: "Requests" },
    { path: "/customer/service-orders", icon: ClipboardList, label: "Services" },
    { path: "/customer/field-reports", icon: FileText, label: "Reports" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Apple-inspired Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-16 items-center justify-between px-6 md:ml-64">
          <h1 className="text-xl font-semibold tracking-tight">Premrest Pulse</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-9 w-9 rounded-full hover:bg-muted/60 transition-smooth"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Desktop Sidebar - refined */}
      <aside className="hidden md:fixed md:left-0 md:top-16 md:bottom-0 md:flex md:w-64 md:flex-col md:border-r md:border-border/40 md:bg-background/50 md:z-40">
        <nav className="flex-1 space-y-2 p-4">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path ||
              (path !== "/customer" && location.pathname.startsWith(path));
            
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content with breathing room */}
      <main className="px-6 py-8 pb-24 md:pb-8 md:ml-64 max-w-7xl">
        {children}
      </main>

      {/* iOS-inspired Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 pb-safe md:hidden">
        <div className="flex items-center justify-around h-20 px-4">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path || 
              (path !== "/customer" && location.pathname.startsWith(path));
            
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center justify-center flex-1 gap-1 py-2 px-3 rounded-xl transition-all duration-200 touch-target ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:scale-95"
                }`}
              >
                <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                  <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[11px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
