import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Trash2, ChevronRight, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Settings as SettingsIcon, 
  User, 
  Palette, 
  Hash, 
  Plug, 
  Calculator,
  Menu as MenuIcon, 
  Users, 
  Shield, 
  FileText, 
  PieChart,
  Headphones,
  Activity,
  ScrollText,
  CreditCard,
  Database,
  Radio,
  Bell,
  Bug,
  Eye
} from "lucide-react";
import CRMStatusesTab from "@/components/settings/CRMStatusesTab";
import GeneralSettingsTab from "@/components/settings/GeneralSettingsTab";
import MenuCustomizationTab from "@/components/settings/MenuCustomizationTab";
import { RolePermissionsTab } from "@/components/settings/RolePermissionsTab";
import { UserManagementTab } from "@/components/settings/UserManagementTab";
import { ChangeLogTab } from "@/components/settings/ChangeLogTab";
import { TemplatesTab } from "@/components/settings/TemplatesTab";
import { ActivityLogTab } from "@/components/settings/ActivityLogTab";
import NumberingTab from "@/components/settings/NumberingTab";
import IntegrationsTab from "@/components/settings/IntegrationsTab";
import AccountSyncTab from "@/components/settings/AccountSyncTab";
import ProjectIntegrationTab from "@/components/settings/ProjectIntegrationTab";
import UserProfileTab from "@/components/settings/UserProfileTab";
import BrandColorsTab from "@/components/settings/BrandColorsTab";
import PresenceSettingsTab from "@/components/settings/PresenceSettingsTab";
import NotificationSettingsTab from "@/components/settings/NotificationSettingsTab";
import { HelpDeskSettingsTab } from "@/components/settings/HelpDeskSettingsTab";
import { ExpenseCategoriesTab } from "@/components/settings/ExpenseCategoriesTab";
import { CreditCardsTab } from "@/components/settings/CreditCardsTab";
import { ExpensePolicyTab } from "@/components/settings/ExpensePolicyTab";
import { SchemaValidatorTab } from "@/components/settings/SchemaValidatorTab";
import { PerformanceMonitorTab } from "@/components/settings/PerformanceMonitorTab";
import APInvoiceSettingsTab from "@/components/settings/APInvoiceSettingsTab";
import { BugReportsList } from "@/components/settings/BugReportsList";
import { TeamsTab } from "@/components/settings/TeamsTab";
import { AccessLogsTab } from "@/components/settings/AccessLogsTab";
import { TeamOnboardingSteps } from "@/components/settings/TeamOnboardingSteps";
import { cn } from "@/lib/utils";
import { Receipt, Shield as ShieldCheck, FileCheck } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface PayRateCategory {
  id: string;
  name: string;
  hourly_rate: number;
  description: string | null;
  is_active: boolean;
}

interface SettingsNavItem {
  title: string;
  value: string;
  icon: any;
  adminOnly?: boolean;
  requiresPermission?: "user_management" | "integrations";
}

interface SettingsNavGroup {
  group: string;
  items: SettingsNavItem[];
}

const settingsNavigation: SettingsNavGroup[] = [
  {
    group: "Account",
    items: [
      { title: "Profile", value: "user-profile", icon: User },
      { title: "Notifications", value: "notifications", icon: Bell },
      { title: "Presence & Status", value: "presence", icon: Radio },
    ]
  },
  {
    group: "Organization",
    items: [
      { title: "General", value: "general", icon: SettingsIcon },
      { title: "Branding", value: "brand-colors", icon: Palette },
      { title: "Navigation", value: "menu", icon: MenuIcon },
    ]
  },
  {
    group: "Team",
    items: [
      { title: "Users", value: "users", icon: Users, requiresPermission: "user_management" },
      { title: "Teams", value: "teams", icon: Users, requiresPermission: "user_management" },
      { title: "Roles & Permissions", value: "permissions", icon: Shield, adminOnly: true },
      { title: "Pay Rates", value: "pay-rates", icon: DollarSign, requiresPermission: "user_management" },
    ]
  },
  {
    group: "Finance",
    items: [
      { title: "AP Invoices", value: "ap-invoice-settings", icon: FileCheck },
      { title: "Expenses", value: "expense-categories", icon: Receipt },
      { title: "Expense Policy", value: "expense-policy", icon: ShieldCheck },
      { title: "Credit Cards", value: "credit-cards", icon: CreditCard },
      { title: "Accounting", value: "accounting", icon: Calculator },
    ]
  },
  {
    group: "Workflows",
    items: [
      { title: "CRM Pipeline", value: "crm-statuses", icon: PieChart },
      { title: "Templates", value: "templates", icon: FileText },
      { title: "Numbering", value: "numbering", icon: Hash },
    ]
  },
  {
    group: "Integrations",
    items: [
      { title: "Connected Apps", value: "integrations", icon: Plug, requiresPermission: "integrations" },
      { title: "Account Sync", value: "account-sync", icon: RefreshCw, requiresPermission: "integrations" },
      { title: "Help Desk", value: "helpdesk", icon: Headphones },
    ]
  },
  {
    group: "Advanced",
    items: [
      { title: "Access Logs", value: "access-logs", icon: Eye, adminOnly: true },
      { title: "Bug Reports", value: "bug-reports", icon: Bug, adminOnly: true },
      { title: "Activity Log", value: "activity-log", icon: Activity, adminOnly: true },
      { title: "Change History", value: "changelog", icon: ScrollText },
      { title: "Schema Validator", value: "schema-validator", icon: Database, adminOnly: true },
      { title: "Performance", value: "performance-monitor", icon: Activity, adminOnly: true },
    ]
  }
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("user-profile");
  const [searchQuery, setSearchQuery] = useState("");
  const { isAdmin, hasPermission, isManagement } = usePermissions();
  const canManageUsers = hasPermission("user_management", "view");
  const canViewIntegrations = hasPermission("integrations", "view");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PayRateCategory | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    hourly_rate: "",
    description: "",
    is_active: true,
  });
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["pay-rate-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pay_rate_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as PayRateCategory[];
    },
  });

  const createCategory = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { error } = await supabase.from("pay_rate_categories").insert({
        tenant_id: profile?.tenant_id,
        name: formData.name,
        hourly_rate: parseFloat(formData.hourly_rate),
        description: formData.description || null,
        is_active: formData.is_active,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-rate-categories"] });
      toast.success("Pay rate category created successfully");
      handleDialogClose();
    },
    onError: () => {
      toast.error("Failed to create pay rate category");
    },
  });

  const updateCategory = useMutation({
    mutationFn: async () => {
      if (!selectedCategory) return;

      const { error } = await supabase
        .from("pay_rate_categories")
        .update({
          name: formData.name,
          hourly_rate: parseFloat(formData.hourly_rate),
          description: formData.description || null,
          is_active: formData.is_active,
        })
        .eq("id", selectedCategory.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-rate-categories"] });
      toast.success("Pay rate category updated successfully");
      handleDialogClose();
    },
    onError: () => {
      toast.error("Failed to update pay rate category");
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pay_rate_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-rate-categories"] });
      toast.success("Pay rate category deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete pay rate category");
    },
  });

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedCategory(null);
    setFormData({
      name: "",
      hourly_rate: "",
      description: "",
      is_active: true,
    });
  };

  const handleEdit = (category: PayRateCategory) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      hourly_rate: category.hourly_rate.toString(),
      description: category.description || "",
      is_active: category.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (selectedCategory) {
      updateCategory.mutate();
    } else {
      createCategory.mutate();
    }
  };

  // Filter settings based on search and permissions
  const filteredNavigation = settingsNavigation.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // Admin-only check
      if (item.adminOnly && !isAdmin) return false;
      // Permission-based check
      if (item.requiresPermission === "user_management" && !canManageUsers && !isAdmin) return false;
      if (item.requiresPermission === "integrations" && !canViewIntegrations && !isAdmin) return false;
      // Search filter
      return item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.group.toLowerCase().includes(searchQuery.toLowerCase());
    })
  })).filter(group => group.items.length > 0);

  // Get current setting info
  const currentSetting = settingsNavigation
    .flatMap(g => g.items)
    .find(item => item.value === activeTab);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-full bg-muted/30">
        {/* Settings Navigation Sidebar - Desktop */}
        <aside className="w-full lg:w-72 border-r bg-background hidden lg:flex flex-col">
          <div className="p-6 border-b space-y-4">
            <div>
              <h1 className="font-semibold text-2xl">Settings</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage your workspace preferences</p>
            </div>
            <div className="relative">
              <SettingsIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {filteredNavigation.map((group) => (
                <div key={group.group}>
                  <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.group}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setActiveTab(item.value)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200",
                          activeTab === item.value
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "hover:bg-muted/60 text-foreground/80 hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left font-medium">{item.title}</span>
                        {activeTab === item.value && (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Mobile Settings Navigation */}
        <div className="lg:hidden w-full border-b p-4 bg-background sticky top-0 z-10 space-y-3">
          <div className="flex items-center gap-3">
            {currentSetting && (
              <>
                <currentSetting.icon className="h-5 w-5 text-muted-foreground" />
                <h2 className="font-semibold text-lg">{currentSetting.title}</h2>
              </>
            )}
          </div>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full p-2.5 border rounded-lg bg-background text-sm font-medium"
          >
            {settingsNavigation.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.items.filter(item => !item.adminOnly || isAdmin).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto w-full">
          <div className={cn(
            "w-full transition-all duration-200",
            activeTab === "schema-validator" || activeTab === "performance-monitor" 
              ? "h-full" 
              : "p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto"
          )}>
            {/* Page Header - Desktop Only */}
            {currentSetting && (
              <div className="hidden lg:block mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <currentSetting.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-3xl font-semibold">{currentSetting.title}</h2>
                </div>
              </div>
            )}
            {activeTab === "general" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <GeneralSettingsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "user-profile" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <UserProfileTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "presence" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <PresenceSettingsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "notifications" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <NotificationSettingsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "brand-colors" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <BrandColorsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "numbering" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <NumberingTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "integrations" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <IntegrationsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "account-sync" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <AccountSyncTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "accounting" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <ProjectIntegrationTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "menu" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <MenuCustomizationTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "users" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <UserManagementTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "teams" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <TeamsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "permissions" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <RolePermissionsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "pay-rates" && (
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Pay Rate Categories</CardTitle>
                    <Button onClick={() => setIsDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Category
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pay rate categories yet
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Hourly Rate</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                {category.hourly_rate.toFixed(2)}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {category.description || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={category.is_active ? "default" : "secondary"}>
                                {category.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(category)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("Delete this category?")) {
                                      deleteCategory.mutate(category.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "templates" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <TemplatesTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "crm-statuses" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <CRMStatusesTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "helpdesk" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <HelpDeskSettingsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "ap-invoice-settings" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <APInvoiceSettingsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "expense-categories" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <ExpenseCategoriesTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "expense-policy" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <ExpensePolicyTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "credit-cards" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <CreditCardsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "activity-log" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <ActivityLogTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "access-logs" && (
              <AccessLogsTab />
            )}

            {activeTab === "bug-reports" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <BugReportsList />
                </CardContent>
              </Card>
            )}

            {activeTab === "changelog" && (
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <ChangeLogTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "schema-validator" && isAdmin && (
              <div className="h-full p-4 sm:p-6 lg:p-8">
                <SchemaValidatorTab />
              </div>
            )}

            {activeTab === "performance-monitor" && isAdmin && (
              <div className="h-full p-4 sm:p-6 lg:p-8">
                <PerformanceMonitorTab />
              </div>
            )}
          </div>
        </main>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCategory ? "Edit" : "Add"} Pay Rate Category
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Senior Technician"
              />
            </div>

            <div>
              <Label htmlFor="hourly_rate">Hourly Rate ($) *</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) =>
                  setFormData({ ...formData, hourly_rate: e.target.value })
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description of this pay rate category"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>
                {selectedCategory ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
