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

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      {/* Sidebar - Desktop */}
      <aside className={cn(
        "hidden lg:flex lg:flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0",
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
            <div className="flex-shrink-0 px-6 pb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-start">
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
          <aside className="fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto">
            <div className="flex flex-col h-full px-6 py-8">
              <div className="flex-shrink-0 flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-lg">SP</span>
                  </div>
                  <h1 className="text-xl font-bold text-sidebar-foreground">Service Pulse</h1>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <User className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => { navigate("/settings"); setSidebarOpen(false); }}>
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={async () => {
                          await supabase.auth.signOut();
                          navigate("/auth");
                          setSidebarOpen(false);
                          toast.success("Signed out successfully");
                        }}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
      <main className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-10 pt-20 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
