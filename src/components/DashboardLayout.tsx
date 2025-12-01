import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCustomMenu } from "@/hooks/useCustomMenu";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ViewModeToggle } from "@/components/layout/ViewModeToggle";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { useViewMode } from "@/contexts/ViewModeContext";
import { GlobalSearch } from "@/components/GlobalSearch";
import RemoteCursors from "@/components/presence/RemoteCursors";
import PresencePanel from "@/components/presence/PresencePanel";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { IssueReportDialog } from "@/components/common/IssueReportDialog";
import { ViewToggleButton } from "@/components/layout/ViewToggleButton";
import { APP_VERSION } from "@/lib/version";
import { usePermissions } from "@/hooks/usePermissions";
import { getRouteModule } from "@/config/routePermissions";
import { useMemo } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  showRightSidebar?: boolean;
  disablePresence?: boolean;
  noPadding?: boolean;
}

export default function DashboardLayout({ children, showRightSidebar = false, disablePresence = false, noPadding = false }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useViewMode();
  useAuthGuard(); // Enforce active user status
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const { menuItems, isLoading: menuLoading } = useCustomMenu();
  const { canView, isLoading: permissionsLoading } = usePermissions();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('expandedMenuFolders');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

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

  const handlePopoverOpen = (itemId: string) => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setOpenPopover(itemId);
  };

  const handlePopoverClose = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    const timeout = setTimeout(() => {
      setOpenPopover(null);
    }, 150); // 150ms delay before closing
    setHoverTimeout(timeout);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  // Filter menu items based on permissions
  const filteredMenuItems = useMemo(() => {
    if (permissionsLoading) return menuItems;
    
    return menuItems.filter(item => {
      const module = getRouteModule(item.path || "");
      if (!module) return true; // Always show items without module requirement
      return canView(module);
    }).map(item => ({
      ...item,
      children: item.children?.filter((child: any) => {
        const module = getRouteModule(child.path || "");
        if (!module) return true;
        return canView(module);
      }) || []
    }));
  }, [menuItems, canView, permissionsLoading]);

  const renderMenuContent = () => {
    const renderMenuItem = (item: any) => {
      const isActive = item.path && location.pathname === item.path;
      const children = item.children || [];
      const isExpanded = expandedFolders.has(item.id);
      const Icon = item.iconComponent;

      // Render folder with popover when collapsed
      if (item.is_folder && sidebarCollapsed && children.length > 0) {
        return (
          <div key={item.id}>
            <Popover open={openPopover === item.id} onOpenChange={(open) => setOpenPopover(open ? item.id : null)}>
              <PopoverTrigger asChild>
                <button
                  onMouseEnter={() => handlePopoverOpen(item.id)}
                  onMouseLeave={handlePopoverClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1 w-full justify-center px-2",
                    "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                side="right" 
                align="start" 
                className="w-56 p-2 z-[9999]"
                onMouseEnter={() => handlePopoverOpen(item.id)}
                onMouseLeave={handlePopoverClose}
              >
                <div className="space-y-1">
                  <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
                    {item.label}
                  </div>
                  {children.map((child) => {
                    const childIsActive = child.path && location.pathname === child.path;
                    const ChildIcon = child.iconComponent;
                    return (
                      <button
                        key={child.id}
                        onClick={() => {
                          if (child.path) {
                            handleNavigate(child.path);
                            setOpenPopover(null);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left",
                          childIsActive
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <ChildIcon className="h-4 w-4" style={child.color && child.color.trim() ? { color: child.color } : undefined} />
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      }

      return (
        <div key={item.id}>
          <div className="flex items-center gap-2">
            {sidebarCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (item.is_folder) {
                        toggleFolder(item.id);
                      } else if (item.path) {
                        handleNavigate(item.path);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      "justify-center px-2"
                    )}
                  >
                    <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => {
                  if (item.is_folder) {
                    toggleFolder(item.id);
                  } else if (item.path) {
                    handleNavigate(item.path);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                {item.is_folder && (
                  <div className="mr-1">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                  </div>
                )}
                <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                {item.label}
              </button>
            )}
          </div>
          
          {/* Render children when folder is expanded */}
          {item.is_folder && isExpanded && children.length > 0 && !sidebarCollapsed && (
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
                    onClick={() => child.path && handleNavigate(child.path)}
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
      <TooltipProvider>
        <div className="space-y-1">
          {filteredMenuItems.map((item) => renderMenuItem(item))}
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Remote Cursors Overlay - DISABLED for performance */}
      {false && !disablePresence && <RemoteCursors />}
      
      {/* Sidebar - Desktop only, completely hidden in mobile view */}
      {!isMobile && (
        <aside className={cn(
          "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0 z-50",
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
          
          <nav className="flex-1 flex flex-col gap-2 px-6 overflow-y-auto">
            {menuLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted/50 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : (
              renderMenuContent()
            )}
          </nav>
          
          <div className="flex-shrink-0 border-t border-sidebar-border px-6 py-4 bg-sidebar">
            {!sidebarCollapsed && (
              <div className="text-[10px] text-muted-foreground/40 text-center mb-2">
                v{APP_VERSION}
              </div>
            )}
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
      )}

      {/* Header and Main Content Container */}
      {isMobile ? (
        <>
          <MobileHeader />
          <main className="flex-1 overflow-hidden pt-14">
            <div className={cn(
              "px-4 py-4 h-full overflow-y-auto",
              "pb-20" // Bottom padding for bottom nav with safe area
            )}>
              {children}
            </div>
          </main>
        </>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header Bar - positioned to the right of sidebar */}
          <div className={cn(
            "z-40 bg-background border-b border-border transition-all duration-300",
            sidebarCollapsed ? "ml-0" : "ml-0"
          )}>
            <div className="flex items-center px-4 py-3 gap-2">
              <GlobalSearch />
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <PresencePanel />
                <NotificationCenter />
                <IssueReportDialog />
                <ViewToggleButton />
                <ViewModeToggle />
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate("/auth");
                    toast.success("Signed out successfully");
                  }}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            <div className={cn(
              "h-full overflow-y-auto w-full",
              !noPadding && "px-3 sm:px-6 lg:px-8"
            )}>
              {children}
            </div>
          </main>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
