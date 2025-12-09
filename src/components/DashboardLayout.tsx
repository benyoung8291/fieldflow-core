import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogOut, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
import { useUnreadMessages } from "@/hooks/chat/useUnreadMessages";

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
  const { canView, isLoading: permissionsLoading, hasLoadedPermissions } = usePermissions();
  const { data: unreadData } = useUnreadMessages();
  const totalUnread = unreadData?.totalUnread ?? 0;
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
    }, 300); // 300ms delay before closing
    setHoverTimeout(timeout);
  };


  // Filter menu items based on permissions
  const filteredMenuItems = useMemo(() => {
    // Don't filter until permissions are definitely loaded - return empty to show skeleton
    if (permissionsLoading || !hasLoadedPermissions) {
      return [];
    }
    
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
  }, [menuItems, canView, permissionsLoading, hasLoadedPermissions]);

  const renderMenuContent = () => {
    const renderMenuItem = (item: any) => {
      const isActive = item.path && location.pathname === item.path;
      const children = item.children || [];
      const isExpanded = expandedFolders.has(item.id);
      const Icon = item.iconComponent;

      // Render folder with popover when collapsed - click-based for reliability
      if (item.is_folder && sidebarCollapsed && children.length > 0) {
        return (
          <div key={item.id}>
            <Popover open={openPopover === item.id} onOpenChange={(open) => setOpenPopover(open ? item.id : null)}>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => setOpenPopover(openPopover === item.id ? null : item.id)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1 w-full justify-center px-2",
                        openPopover === item.id && "bg-sidebar-accent",
                        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
              <PopoverContent 
                side="right" 
                align="start" 
                sideOffset={4}
                className="w-56 p-2 z-[9999]"
                onInteractOutside={() => setOpenPopover(null)}
              >
                <div className="space-y-1">
                  <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
                    {item.label}
                  </div>
                  {children.map((child) => {
                    const childIsActive = child.path && location.pathname === child.path;
                    const ChildIcon = child.iconComponent;
                    return child.path ? (
                      <Link
                        key={child.id}
                        to={child.path}
                        onClick={() => setOpenPopover(null)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-left",
                          childIsActive
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <ChildIcon className="h-4 w-4" style={child.color && child.color.trim() ? { color: child.color } : undefined} />
                        {child.label}
                      </Link>
                    ) : null;
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      }

      // Non-folder items with paths should be links
      if (!item.is_folder && item.path) {
        return (
          <div key={item.id}>
            {sidebarCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1 justify-center px-2",
                      "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    activeClassName="bg-sidebar-primary text-sidebar-primary-foreground"
                  >
                    <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : (
              <NavLink
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground"
              >
                <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                {item.label}
                {item.path === "/chat" && totalUnread > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </NavLink>
            )}
          </div>
        );
      }

      // Folder items stay as buttons for toggling
      return (
        <div key={item.id}>
          <div className="flex items-center gap-2">
            {sidebarCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleFolder(item.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1",
                      "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
                onClick={() => toggleFolder(item.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <div className="mr-1">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                </div>
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
                const ChildIcon = child.iconComponent;
                return child.path ? (
                  <NavLink
                    key={child.id}
                    to={child.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left",
                      "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    activeClassName="bg-sidebar-primary text-sidebar-primary-foreground"
                  >
                    <ChildIcon className="h-4 w-4" style={child.color && child.color.trim() ? { color: child.color } : undefined} />
                    {child.label}
                  </NavLink>
                ) : null;
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

  // Check if we're on a quote detail page to enable collaborative editing
  const isQuoteDetailPage = location.pathname.match(/^\/quotes\/[a-f0-9-]+$/);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Remote Cursors - enabled for quote detail pages for collaborative editing */}
      {isQuoteDetailPage && !disablePresence && <RemoteCursors />}
      
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
            {(menuLoading || permissionsLoading || !hasLoadedPermissions) ? (
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
              "h-full overflow-y-auto",
              !noPadding && "px-4 py-4",
              !noPadding && "pb-20" // Bottom padding for bottom nav with safe area
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
