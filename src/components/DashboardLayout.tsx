import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogOut, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
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

  // Check if a folder contains the active route
  const folderContainsActiveRoute = (item: any): boolean => {
    if (!item.children) return false;
    return item.children.some((child: any) => child.path && location.pathname === child.path);
  };

  const renderMenuContent = () => {
    const renderMenuItem = (item: any) => {
      const isActive = item.path && location.pathname === item.path;
      const children = item.children || [];
      const isExpanded = expandedFolders.has(item.id);
      const Icon = item.iconComponent;
      const hasActiveChild = folderContainsActiveRoute(item);
      const isChatItem = item.path === "/chat";

      // Render folder with popover when collapsed - click-based for reliability
      if (item.is_folder && sidebarCollapsed && children.length > 0) {
        return (
          <div key={item.id}>
            <Popover open={openPopover === item.id} onOpenChange={(open) => setOpenPopover(open ? item.id : null)}>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => setOpenPopover(openPopover === item.id ? null : item.id)}
                      className={cn(
                        "relative flex items-center justify-center w-10 h-10 mx-auto rounded-lg text-sm font-medium transition-all duration-200",
                        openPopover === item.id && "bg-sidebar-accent/80 scale-105",
                        hasActiveChild 
                          ? "bg-sidebar-primary/20 text-sidebar-primary-foreground ring-2 ring-sidebar-primary/50" 
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:scale-105"
                      )}
                    >
                      <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                      {/* Folder indicator dot */}
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sidebar-foreground/40" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
              <PopoverContent 
                side="right" 
                align="start" 
                sideOffset={8}
                className="w-56 p-2 z-[9999] animate-in slide-in-from-left-2 duration-200"
                onInteractOutside={() => setOpenPopover(null)}
              >
                <div className="space-y-1">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border mb-2">
                    {item.label}
                  </div>
                  {children.map((child: any) => {
                    const childIsActive = child.path && location.pathname === child.path;
                    const ChildIcon = child.iconComponent;
                    return child.path ? (
                      <Link
                        key={child.id}
                        to={child.path}
                        onClick={() => setOpenPopover(null)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 w-full text-left",
                          childIsActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground hover:bg-accent/80 hover:translate-x-0.5"
                        )}
                      >
                        <ChildIcon className="h-4 w-4 flex-shrink-0" style={child.color && child.color.trim() ? { color: child.color } : undefined} />
                        <span className="truncate">{child.label}</span>
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
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.path}
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 mx-auto rounded-lg text-sm font-medium transition-all duration-200",
                      "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:scale-105"
                    )}
                    activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-md scale-105"
                  >
                    <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                    {/* Unread badge for chat in collapsed mode */}
                    {isChatItem && totalUnread > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground ring-2 ring-sidebar-background">
                        {totalUnread > 9 ? "9+" : totalUnread}
                      </span>
                    )}
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium" sideOffset={8}>
                  <span className="flex items-center gap-2">
                    {item.label}
                    {isChatItem && totalUnread > 0 && (
                      <span className="text-xs text-muted-foreground">({totalUnread} unread)</span>
                    )}
                  </span>
                </TooltipContent>
              </Tooltip>
            ) : (
              <NavLink
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:translate-x-0.5"
                )}
                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
              >
                <Icon className="h-5 w-5 flex-shrink-0" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                <span className="truncate">{item.label}</span>
                {isChatItem && totalUnread > 0 && (
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
          <div className="flex items-center">
            {sidebarCollapsed ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleFolder(item.id)}
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 mx-auto rounded-lg text-sm font-medium transition-all duration-200",
                      hasActiveChild 
                        ? "bg-sidebar-primary/20 text-sidebar-primary-foreground ring-2 ring-sidebar-primary/50" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:scale-105"
                    )}
                  >
                    <Icon className="h-5 w-5" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sidebar-foreground/40" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => toggleFolder(item.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full",
                  hasActiveChild 
                    ? "bg-sidebar-primary/10 text-sidebar-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                <div className={cn(
                  "transition-transform duration-200",
                  isExpanded && "rotate-90"
                )}>
                  <ChevronRightIcon className="h-4 w-4" />
                </div>
                <Icon className="h-5 w-5 flex-shrink-0" style={item.color && item.color.trim() ? { color: item.color } : undefined} />
                <span className="truncate">{item.label}</span>
              </button>
            )}
          </div>
          
          {/* Render children when folder is expanded with animation */}
          {item.is_folder && isExpanded && children.length > 0 && !sidebarCollapsed && (
            <div 
              className="ml-5 mt-1 space-y-0.5 border-l-2 pl-3 animate-in slide-in-from-top-2 duration-200" 
              style={item.color && item.color.trim() ? { borderColor: item.color } : { borderColor: 'hsl(var(--sidebar-border))' }}
            >
              {children.map((child: any) => {
                const ChildIcon = child.iconComponent;
                return child.path ? (
                  <NavLink
                    key={child.id}
                    to={child.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 w-full text-left",
                      "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground hover:translate-x-0.5"
                    )}
                    activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  >
                    <ChildIcon className="h-4 w-4 flex-shrink-0" style={child.color && child.color.trim() ? { color: child.color } : undefined} />
                    <span className="truncate">{child.label}</span>
                  </NavLink>
                ) : null;
              })}
            </div>
          )}
        </div>
      );
    };

    return (
      <TooltipProvider delayDuration={100}>
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
          "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-out flex-shrink-0 z-50",
          sidebarCollapsed ? "w-16" : "w-64"
        )}>
        <div className="flex flex-col h-full">
          {/* Header - compact in collapsed state */}
          <div className={cn(
            "flex-shrink-0 transition-all duration-300",
            sidebarCollapsed ? "px-3 py-4" : "px-4 py-6"
          )}>
            <div className={cn(
              "flex items-center",
              sidebarCollapsed ? "justify-center" : "gap-3"
            )}>
              <div className={cn(
                "rounded-lg bg-primary flex items-center justify-center transition-all duration-200 shadow-md",
                sidebarCollapsed ? "h-9 w-9" : "h-10 w-10"
              )}>
                <span className={cn(
                  "text-primary-foreground font-bold",
                  sidebarCollapsed ? "text-sm" : "text-lg"
                )}>SP</span>
              </div>
              {!sidebarCollapsed && (
                <h1 className="text-lg font-bold text-sidebar-foreground truncate">Service Pulse</h1>
              )}
            </div>
          </div>
          
          {/* Navigation */}
          <nav className={cn(
            "flex-1 flex flex-col gap-1 overflow-y-auto transition-all duration-300",
            sidebarCollapsed ? "px-3" : "px-3"
          )}>
            {(menuLoading || permissionsLoading || !hasLoadedPermissions) ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "bg-sidebar-accent/30 animate-pulse rounded-lg",
                      sidebarCollapsed ? "h-10 w-10 mx-auto" : "h-10"
                    )} 
                  />
                ))}
              </div>
            ) : (
              renderMenuContent()
            )}
          </nav>
          
          {/* Footer */}
          <div className={cn(
            "flex-shrink-0 border-t border-sidebar-border bg-sidebar transition-all duration-300",
            sidebarCollapsed ? "px-3 py-3" : "px-3 py-4"
          )}>
            {!sidebarCollapsed && (
              <div className="text-[10px] text-sidebar-foreground/30 text-center mb-2">
                v{APP_VERSION}
              </div>
            )}
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className={cn(
                    "transition-all duration-200 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                    sidebarCollapsed 
                      ? "w-10 h-10 p-0 mx-auto flex items-center justify-center" 
                      : "w-full justify-start gap-2"
                  )}
                >
                  <div className={cn(
                    "transition-transform duration-200",
                    sidebarCollapsed && "rotate-180"
                  )}>
                    <ChevronLeft className="h-4 w-4" />
                  </div>
                  {!sidebarCollapsed && (
                    <span className="text-xs">Collapse</span>
                  )}
                </Button>
              </TooltipTrigger>
              {sidebarCollapsed && (
                <TooltipContent side="right" sideOffset={8}>
                  <span className="flex items-center gap-2">
                    Expand sidebar
                    <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded">⌘B</kbd>
                  </span>
                </TooltipContent>
              )}
            </Tooltip>
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
