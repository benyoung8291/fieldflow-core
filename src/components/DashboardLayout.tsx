import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu, Pencil, Check, GripVertical, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useCustomMenu } from "@/hooks/useCustomMenu";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface SortableMenuItemProps {
  item: any;
  isActive: boolean;
  isEditMode: boolean;
  isMobile?: boolean;
  onNavigate: (path: string) => void;
}

function SortableMenuItem({ item, isActive, isEditMode, isMobile, onNavigate }: SortableMenuItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const Icon = item.iconComponent;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      {isEditMode && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <button
        onClick={() => !isEditMode && item.path && onNavigate(item.path)}
        disabled={isEditMode}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1",
          isEditMode ? "cursor-default" : "",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        {item.label}
      </button>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { menuItems } = useCustomMenu();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = menuItems.findIndex((item) => item.id === active.id);
    const newIndex = menuItems.findIndex((item) => item.id === over.id);

    const reordered = [...menuItems];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update order in database
    try {
      for (let i = 0; i < reordered.length; i++) {
        await supabase
          .from("menu_items")
          .update({ item_order: i })
          .eq("id", reordered[i].id);
      }
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      toast.success("Menu order updated");
    } catch (error) {
      toast.error("Failed to update menu order");
    }
  };

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
            {isEditMode && (
              <div className="cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <button
              onClick={() => {
                if (!isEditMode) {
                  if (item.is_folder) {
                    toggleFolder(item.id);
                  } else if (item.path) {
                    handleNavigate(item.path, isMobile);
                  }
                }
              }}
              disabled={isEditMode && !item.is_folder}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex-1",
                isEditMode ? "cursor-default" : "",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              style={item.color && !isActive ? { borderLeft: `3px solid ${item.color}` } : undefined}
            >
              {item.is_folder && (
                <div className="mr-1">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              )}
              <Icon className="h-5 w-5" style={item.color ? { color: item.color } : undefined} />
              {item.label}
            </button>
          </div>
          
          {/* Render children when folder is expanded */}
          {item.is_folder && isExpanded && children.length > 0 && (
            <div className="ml-6 mt-1 space-y-1 border-l-2 border-sidebar-border pl-2">
              {children.map((child) => {
                const childIsActive = child.path && location.pathname === child.path;
                const ChildIcon = child.iconComponent;
                return (
                  <button
                    key={child.id}
                    onClick={() => !isEditMode && child.path && handleNavigate(child.path, isMobile)}
                    disabled={isEditMode}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full",
                      isEditMode ? "cursor-default" : "",
                      childIsActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    style={child.color && !childIsActive ? { borderLeft: `3px solid ${child.color}` } : undefined}
                  >
                    <ChildIcon className="h-4 w-4" style={child.color ? { color: child.color } : undefined} />
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={menuItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {menuItems.map((item) => renderMenuItem(item))}
          </div>
        </SortableContext>
      </DndContext>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-1 flex-col gap-y-5 px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">FF</span>
              </div>
              <h1 className="text-xl font-bold text-sidebar-foreground">FieldFlow</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditMode(!isEditMode)}
                className="h-8 w-8"
              >
                {isEditMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
          </div>
          <nav className="flex flex-1 flex-col gap-2">
            {renderMenuContent()}
          </nav>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-lg">FF</span>
                  </div>
                  <h1 className="text-xl font-bold text-sidebar-foreground">FieldFlow</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="h-8 w-8"
                  >
                    {isEditMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <User className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
              <nav className="flex flex-1 flex-col gap-2">
                {renderMenuContent(true)}
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
