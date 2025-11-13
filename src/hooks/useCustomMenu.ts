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
  { name: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", color: "#3b82f6", isFolder: false },
  { name: "Quotes", href: "/quotes", icon: "FileText", color: "#3b82f6", isFolder: false },
  { name: "Pipeline", href: "/pipeline", icon: "GitBranch", color: "#3b82f6", isFolder: false },
  { name: "Projects", href: "/projects", icon: "FolderKanban", color: "#3b82f6", isFolder: false },
  { name: "Service Orders", href: "/service-orders", icon: "Wrench", color: "#f59e0b", isFolder: false },
  { name: "Service Contracts", href: "/service-contracts", icon: "FileSignature", color: "#f59e0b", isFolder: false },
  { name: "Scheduler", href: "/scheduler", icon: "Calendar", color: "#f59e0b", isFolder: false },
  { name: "Appointments", href: "/appointments", icon: "CalendarCheck", color: "#f59e0b", isFolder: false },
  { name: "Tasks", href: "/tasks", icon: "CheckSquare", color: "#f59e0b", isFolder: false },
  { name: "Customers", href: "/customers", icon: "Users", color: "#10b981", isFolder: false },
  { name: "Leads", href: "/leads", icon: "Target", color: "#10b981", isFolder: false },
  { name: "CRM Hub", href: "/crm-hub", icon: "Building", color: "#10b981", isFolder: false },
  { name: "Workers", href: "/workers", icon: "HardHat", color: "#f59e0b", isFolder: false },
  { name: "Skills", href: "/skills", icon: "Award", color: "#f59e0b", isFolder: false },
  { name: "Training Matrix", href: "/training-matrix", icon: "GraduationCap", color: "#f59e0b", isFolder: false },
  { 
    name: "Accounts", 
    href: null, 
    icon: "DollarSign", 
    color: "#8b5cf6", 
    isFolder: true,
    children: [
      { name: "Invoices", href: "/invoices", icon: "Receipt", color: "#8b5cf6", isFolder: false },
      { name: "Recurring Invoices", href: "/recurring-invoices", icon: "RefreshCw", color: "#8b5cf6", isFolder: false },
      { name: "Suppliers", href: "/suppliers", icon: "Building2", color: "#8b5cf6", isFolder: false },
      { name: "Purchase Orders", href: "/purchase-orders", icon: "FileText", color: "#8b5cf6", isFolder: false },
      { name: "Expenses", href: "/expenses", icon: "Receipt", color: "#8b5cf6", isFolder: false },
      { name: "Card Reconciliation", href: "/credit-card-reconciliation", icon: "CreditCard", color: "#8b5cf6", isFolder: false },
      { name: "Unassigned Transactions", href: "/unassigned-transactions", icon: "AlertCircle", color: "#8b5cf6", isFolder: false },
    ]
  },
  { name: "Help Desk", href: "/helpdesk", icon: "Headphones", color: "#ec4899", isFolder: false },
  { name: "Analytics", href: "/analytics", icon: "BarChart3", color: "#ec4899", isFolder: false },
  { name: "Settings", href: "/settings", icon: "Settings", color: "#6366f1", isFolder: false },
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
      return defaultNavigation.map((item, index) => {
        const menuItem: MenuItemWithIcon = {
          id: item.href || `folder-${item.name}`,
          label: item.name,
          icon: item.icon,
          path: item.href,
          parent_id: null,
          item_order: index,
          is_folder: item.isFolder,
          is_visible: true,
          is_system: true,
          color: item.color,
          iconComponent: (LucideIcons as any)[item.icon] || LucideIcons.Circle,
        };

        // Add children if it's a folder
        if (item.isFolder && (item as any).children) {
          menuItem.children = (item as any).children.map((child: any, childIndex: number) => ({
            id: child.href,
            label: child.name,
            icon: child.icon,
            path: child.href,
            parent_id: menuItem.id,
            item_order: childIndex,
            is_folder: child.isFolder || false,
            is_visible: true,
            is_system: true,
            color: child.color,
            iconComponent: (LucideIcons as any)[child.icon] || LucideIcons.Circle,
          }));
        }

        return menuItem;
      });
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
