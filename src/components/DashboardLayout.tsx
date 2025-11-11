import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu, User, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useCustomMenu } from "@/hooks/useCustomMenu";
import { ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ViewModeToggle } from "@/components/layout/ViewModeToggle";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { useViewMode } from "@/contexts/ViewModeContext";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isMobile } = useViewMode();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const { menuItems } = useCustomMenu();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('expandedMenuFolders');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem('expandedMenuFolders', JSON.stringify(Array.from(expandedFolders)));
  }, [expandedFolders]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleNavigate = (path: string, isMobile = false) => {
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  };

  const renderMenuContent = (isMobile = false) => {
    const renderMenuItem = (item: any) => {
      const isActive = item.path && location.pathname === item.path;
      const children = item.children || [];
      const isExpanded = expandedFolders.has(item.id);
      const Icon = item.iconComponent;

      return (
        <div key={item.id}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (item.is_folder) {
                  toggleFolder(item.id);
                } else if (item.path) {
                  handleNavigate(item.path, isMobile);
                }
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                sidebarCollapsed && !isMobile ? "justify-center px-2" : ""
              )}
              title={sidebarCollapsed && !isMobile ? item.label : undefined}
            >
              {item.is_folder && !sidebarCollapsed && (
                <div className="mr-1">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                </div>
              )}
              <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
              {!sidebarCollapsed && item.label}
            </button>
          </div>
          
          {/* Render children when folder is expanded */}
          {item.is_folder && isExpanded && children.length > 0 && (!sidebarCollapsed || isMobile) && (
            <div 
              className="ml-6 mt-1 space-y-1 border-l-2 pl-2" 
              style={item.color && item.color.trim() ? { borderColor: item.color } : { borderColor: 'hsl(var(--sidebar-border))' }}
            >
              {children.map((child) => {
                const childIsActive = child.path && location.pathname === child.path;
                const ChildIcon = child.iconComponent;
                return (
                  <button
                    key={child.id}
                    onClick={() => child.path && handleNavigate(child.path, isMobile)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left",
                      childIsActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <ChildIcon className="h-4 w-4" style={child.color && child.color.trim() ? { color: child.color } : undefined} />
                    {child.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-1">
        {menuItems.map((item) => renderMenuItem(item))}
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop only, hidden in mobile view */}
      <aside className={cn(
        "flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0",
        isMobile ? "hidden" : "flex", // Hide completely in mobile view
        sidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0 px-6 py-8">
            <div className={cn(
              "flex items-center",
              sidebarCollapsed ? "justify-center" : "justify-between"
            )}>
              {!sidebarCollapsed && (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-lg">SP</span>
                  </div>
                  <h1 className="text-xl font-bold text-sidebar-foreground">Service Pulse</h1>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">SP</span>
                </div>
              )}
            </div>
          </div>
          
          {/* User dropdown moved here for better visibility */}
          {!sidebarCollapsed && (
            <div className="flex-shrink-0 px-6 pb-4 space-y-2">
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start">
                      <User className="h-4 w-4 mr-2" />
                      Account
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => navigate("/settings")}>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={async () => {
                        await supabase.auth.signOut();
                        navigate("/auth");
                        toast.success("Signed out successfully");
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ThemeToggle />
              </div>
            </div>
          )}
          
          <nav className="flex-1 flex flex-col gap-2 px-6 overflow-y-auto">
            {renderMenuContent()}
          </nav>
          
          <div className="flex-shrink-0 border-t border-sidebar-border px-6 py-4 bg-sidebar">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                "w-full hover:bg-sidebar-accent",
                sidebarCollapsed ? "px-2" : ""
              )}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Collapse
                </>
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Top Header Bar */}
      {isMobile ? (
        <MobileHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      ) : (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background border-b border-border">
          <div className="flex items-center justify-end px-4 py-3 gap-2">
            <ViewModeToggle />
            <ThemeToggle />
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay - Only show when explicitly opened */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        >
          <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto">
            <div className="flex flex-col h-full px-6 py-8">
              <div className="flex-shrink-0 flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-lg">SP</span>
                  </div>
                  <h1 className="text-xl font-bold text-sidebar-foreground">Service Pulse</h1>
                </div>
              </div>
              <nav className="flex-1 flex flex-col gap-2 overflow-y-auto">
                {renderMenuContent(true)}
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className={cn(
          "px-4 sm:px-6 lg:px-8 py-8 lg:py-10 h-full overflow-y-auto",
          "pt-20", // Top padding for fixed header
          isMobile && "pb-20" // Bottom padding for bottom nav
        )}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
