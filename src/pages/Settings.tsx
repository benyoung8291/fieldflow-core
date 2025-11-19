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
  Bell
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
}

interface SettingsNavGroup {
  group: string;
  items: SettingsNavItem[];
}

const settingsNavigation: SettingsNavGroup[] = [
  {
    group: "Personal",
    items: [
      { title: "My Profile", value: "user-profile", icon: User },
      { title: "Presence", value: "presence", icon: Radio },
      { title: "Notifications", value: "notifications", icon: Bell },
    ]
  },
  {
    group: "Company Settings",
    items: [
      { title: "General", value: "general", icon: SettingsIcon },
      { title: "Brand Colors", value: "brand-colors", icon: Palette },
      { title: "Numbering", value: "numbering", icon: Hash },
      { title: "Menu", value: "menu", icon: MenuIcon },
    ]
  },
  {
    group: "Integrations",
    items: [
      { title: "Integrations", value: "integrations", icon: Plug },
      { title: "Account Sync", value: "account-sync", icon: RefreshCw },
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
      { title: "AP Invoice Settings", value: "ap-invoice-settings", icon: FileCheck },
      { title: "Expense Categories", value: "expense-categories", icon: Receipt },
      { title: "Expense Policy", value: "expense-policy", icon: ShieldCheck },
      { title: "Credit Cards", value: "credit-cards", icon: CreditCard },
    ]
  },
  {
    group: "System",
    items: [
      { title: "Activity Log", value: "activity-log", icon: Activity },
      { title: "Change Log", value: "changelog", icon: ScrollText },
      { title: "Schema Validator", value: "schema-validator", icon: Database, adminOnly: true },
      { title: "Performance Monitor", value: "performance-monitor", icon: Activity, adminOnly: true },
    ]
  }
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const { isAdmin } = usePermissions();
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

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row h-full">
        {/* Settings Navigation Sidebar - Desktop */}
        <aside className="w-full lg:w-64 border-r lg:border-b-0 border-b bg-background hidden lg:block">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg">Settings</h2>
            <p className="text-sm text-muted-foreground">Manage your business</p>
          </div>
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <div className="p-2">
              {settingsNavigation.map((group) => {
                // Filter out admin-only items if user is not admin
                const filteredItems = group.items.filter(item => 
                  !item.adminOnly || isAdmin
                );
                
                if (filteredItems.length === 0) return null;
                
                return (
                  <div key={group.group} className="mb-4">
                    <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.group}
                    </h3>
                    <div className="space-y-1">
                      {filteredItems.map((item) => (
                        <button
                          key={item.value}
                          onClick={() => setActiveTab(item.value)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                            activeTab === item.value
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1 text-left">{item.title}</span>
                          {activeTab === item.value && <ChevronRight className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        {/* Mobile Settings Dropdown */}
        <div className="lg:hidden w-full border-b p-4 bg-background sticky top-0 z-10">
          <Label className="text-sm font-semibold mb-2 block">Settings</Label>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
          >
            {settingsNavigation.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.items.map((item) => (
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
            "w-full",
            activeTab === "schema-validator" || activeTab === "performance-monitor" 
              ? "h-full" 
              : "p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto"
          )}>
            {activeTab === "general" && (
              <Card>
                <CardContent className="pt-6">
                  <GeneralSettingsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "user-profile" && (
              <Card>
                <CardContent className="pt-6">
                  <UserProfileTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "presence" && (
              <Card>
                <CardContent className="pt-6">
                  <PresenceSettingsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "notifications" && (
              <Card>
                <CardContent className="pt-6">
                  <NotificationSettingsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "brand-colors" && (
              <Card>
                <CardContent className="pt-6">
                  <BrandColorsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "numbering" && (
              <Card>
                <CardContent className="pt-6">
                  <NumberingTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "integrations" && (
              <Card>
                <CardContent className="pt-6">
                  <IntegrationsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "account-sync" && (
              <Card>
                <CardContent className="pt-6">
                  <AccountSyncTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "accounting" && (
              <Card>
                <CardContent className="pt-6">
                  <ProjectIntegrationTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "menu" && (
              <Card>
                <CardContent className="pt-6">
                  <MenuCustomizationTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "users" && (
              <Card>
                <CardContent className="pt-6">
                  <UserManagementTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "permissions" && (
              <Card>
                <CardContent className="pt-6">
                  <RolePermissionsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "pay-rates" && (
              <Card>
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
              <Card>
                <CardContent className="pt-6">
                  <TemplatesTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "crm-statuses" && (
              <Card>
                <CardContent className="pt-6">
                  <CRMStatusesTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "helpdesk" && (
              <Card>
                <CardContent className="pt-6">
                  <HelpDeskSettingsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "ap-invoice-settings" && (
              <APInvoiceSettingsTab />
            )}

            {activeTab === "expense-categories" && (
              <Card>
                <CardContent className="pt-6">
                  <ExpenseCategoriesTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "expense-policy" && (
              <Card>
                <CardContent className="pt-6">
                  <ExpensePolicyTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "credit-cards" && (
              <Card>
                <CardContent className="pt-6">
                  <CreditCardsTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "activity-log" && (
              <Card>
                <CardContent className="pt-6">
                  <ActivityLogTab />
                </CardContent>
              </Card>
            )}

            {activeTab === "changelog" && (
              <Card>
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
