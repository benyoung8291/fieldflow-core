import { 
  Settings, 
  User, 
  Palette, 
  Hash, 
  Plug, 
  Calculator,
  Menu as MenuIcon, 
  Users, 
  Shield, 
  DollarSign, 
  FileText, 
  PieChart,
  Headphones,
  Activity,
  ScrollText
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const settingsItems = [
  {
    group: "Personal",
    items: [
      { title: "My Profile", value: "user-profile", icon: User },
    ]
  },
  {
    group: "Company Settings",
    items: [
      { title: "General", value: "general", icon: Settings },
      { title: "Brand Colors", value: "brand-colors", icon: Palette },
      { title: "Numbering", value: "numbering", icon: Hash },
      { title: "Menu", value: "menu", icon: MenuIcon },
    ]
  },
  {
    group: "Integrations",
    items: [
      { title: "Integrations", value: "integrations", icon: Plug },
      { title: "Accounting", value: "accounting", icon: Calculator },
    ]
  },
  {
    group: "Team & Access",
    items: [
      { title: "Users", value: "users", icon: Users },
      { title: "Permissions", value: "permissions", icon: Shield },
      { title: "Pay Rates", value: "pay-rates", icon: DollarSign },
    ]
  },
  {
    group: "Configuration",
    items: [
      { title: "Templates", value: "templates", icon: FileText },
      { title: "CRM Pipeline", value: "crm-statuses", icon: PieChart },
      { title: "Help Desk", value: "helpdesk", icon: Headphones },
    ]
  },
  {
    group: "System",
    items: [
      { title: "Activity Log", value: "activity-log", icon: Activity },
      { title: "Change Log", value: "changelog", icon: ScrollText },
    ]
  }
];

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className={isCollapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarContent>
        {settingsItems.map((group) => (
          <SidebarGroup key={group.group}>
            {!isCollapsed && <SidebarGroupLabel>{group.group}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.value)}
                      isActive={activeTab === item.value}
                      className="cursor-pointer"
                      tooltip={isCollapsed ? item.title : undefined}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
