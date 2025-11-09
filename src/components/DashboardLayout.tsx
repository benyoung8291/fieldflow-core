import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useCustomMenu } from "@/hooks/useCustomMenu";
import { ChevronDown, ChevronRight } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { menuItems } = useCustomMenu();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const renderMenuItem = (item: any, isMobile = false) => {
    const Icon = item.iconComponent;
    const isActive = item.path && location.pathname === item.path;
    const isExpanded = expandedFolders.has(item.id);

    if (item.is_folder) {
      return (
        <div key={item.id}>
          <button
            onClick={() => toggleFolder(item.id)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full",
              "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="flex-1 text-left">{item.label}</span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {isExpanded && item.children && (
            <div className="ml-8 mt-1 space-y-1">
              {item.children.map((child: any) => renderMenuItem(child, isMobile))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => {
          if (item.path) {
            navigate(item.path);
            if (isMobile) setSidebarOpen(false);
          }
        }}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        {item.label}
      </button>
    );
  };

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
            {menuItems.map((item) => renderMenuItem(item))}
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
                {menuItems.map((item) => renderMenuItem(item, true))}
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
