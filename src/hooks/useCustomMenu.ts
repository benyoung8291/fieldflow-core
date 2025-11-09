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
}

export interface MenuItemWithIcon extends MenuItem {
  iconComponent: any;
  children?: MenuItemWithIcon[];
}

const defaultNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { name: "Quotes", href: "/quotes", icon: "FileText" },
  { name: "Pipeline", href: "/pipeline", icon: "GitBranch" },
  { name: "Projects", href: "/projects", icon: "FolderKanban" },
  { name: "Service Orders", href: "/service-orders", icon: "Wrench" },
  { name: "Service Contracts", href: "/service-contracts", icon: "FileSignature" },
  { name: "Scheduler", href: "/scheduler", icon: "Calendar" },
  { name: "Customers", href: "/customers", icon: "Users" },
  { name: "Leads", href: "/leads", icon: "Target" },
  { name: "Workers", href: "/workers", icon: "HardHat" },
  { name: "Analytics", href: "/analytics", icon: "BarChart3" },
  { name: "Settings", href: "/settings", icon: "Settings" },
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
