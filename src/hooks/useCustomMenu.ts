import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as LucideIcons from "lucide-react";

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string | null;
  parent_id: string | null;
  item_order: number;
  is_folder: boolean;
  is_visible: boolean;
  is_system: boolean;
  color: string | null;
}

export interface MenuItemWithIcon extends MenuItem {
  iconComponent: any;
  children?: MenuItemWithIcon[];
}

const defaultNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", color: "#3b82f6" },
  { name: "Quotes", href: "/quotes", icon: "FileText", color: "#3b82f6" },
  { name: "Pipeline", href: "/pipeline", icon: "GitBranch", color: "#3b82f6" },
  { name: "Projects", href: "/projects", icon: "FolderKanban", color: "#3b82f6" },
  { name: "Service Orders", href: "/service-orders", icon: "Wrench", color: "#f59e0b" },
  { name: "Service Contracts", href: "/service-contracts", icon: "FileSignature", color: "#f59e0b" },
  { name: "Scheduler", href: "/scheduler", icon: "Calendar", color: "#f59e0b" },
  { name: "Appointments", href: "/appointments", icon: "CalendarCheck", color: "#f59e0b" },
  { name: "Customers", href: "/customers", icon: "Users", color: "#10b981" },
  { name: "Leads", href: "/leads", icon: "Target", color: "#10b981" },
  { name: "Workers", href: "/workers", icon: "HardHat", color: "#f59e0b" },
  { name: "Analytics", href: "/analytics", icon: "BarChart3", color: "#ec4899" },
  { name: "Settings", href: "/settings", icon: "Settings", color: "#6366f1" },
];

export function useCustomMenu() {
  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ["menu-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_visible", true)
        .order("item_order");

      if (error) throw error;
      return (data as MenuItem[]) || [];
    },
  });

  // Build hierarchical structure
  const buildMenuStructure = (): MenuItemWithIcon[] => {
    if (menuItems.length === 0) {
      // Return default navigation if no custom menu
      return defaultNavigation.map((item) => ({
        id: item.href,
        label: item.name,
        icon: item.icon,
        path: item.href,
        parent_id: null,
        item_order: 0,
        is_folder: false,
        is_visible: true,
        is_system: true,
        color: item.color,
        iconComponent: (LucideIcons as any)[item.icon] || LucideIcons.Circle,
      }));
    }

    const topLevelItems = menuItems
      .filter((item) => !item.parent_id)
      .map((item) => {
        const iconComponent = (LucideIcons as any)[item.icon] || LucideIcons.Circle;
        const children = menuItems
          .filter((child) => child.parent_id === item.id)
          .map((child) => ({
            ...child,
            iconComponent: (LucideIcons as any)[child.icon] || LucideIcons.Circle,
          }));

        return {
          ...item,
          iconComponent,
          children: children.length > 0 ? children : undefined,
        };
      });

    return topLevelItems;
  };

  return {
    menuItems: buildMenuStructure(),
    isLoading,
    hasCustomMenu: menuItems.length > 0,
  };
}
