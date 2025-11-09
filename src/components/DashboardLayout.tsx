import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  Calendar,
  Warehouse,
  FileText,
  Settings,
  LogOut,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Quotes", href: "/quotes", icon: FileText },
  { name: "Projects", href: "/projects", icon: FileText },
  { name: "Service Orders", href: "/service-orders", icon: ClipboardList },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Scheduler", href: "/scheduler", icon: Calendar },
  { name: "Workers", href: "/workers", icon: Users },
  { name: "Warehouse", href: "/warehouse", icon: Warehouse },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-1 flex-col gap-y-5 px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">FF</span>
            </div>
            <h1 className="text-xl font-bold text-sidebar-foreground">FieldFlow</h1>
          </div>
          <nav className="flex flex-1 flex-col gap-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </button>
              );
            })}
          </nav>
          <Button
            variant="outline"
            className="justify-start gap-3 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => navigate("/auth")}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b border-border px-4 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border">
            <div className="flex flex-1 flex-col gap-y-5 px-6 py-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">FF</span>
                </div>
                <h1 className="text-xl font-bold text-sidebar-foreground">FieldFlow</h1>
              </div>
              <nav className="flex flex-1 flex-col gap-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        navigate(item.href);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.name}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
