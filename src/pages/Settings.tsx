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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, DollarSign, Trash2 } from "lucide-react";
import QuoteTemplatesTab from "@/components/settings/QuoteTemplatesTab";
import MessageTemplatesTab from "@/components/settings/MessageTemplatesTab";
import TermsTemplatesTab from "@/components/settings/TermsTemplatesTab";
import CRMStatusesTab from "@/components/settings/CRMStatusesTab";

interface PayRateCategory {
  id: string;
  name: string;
  hourly_rate: number;
  description: string | null;
  is_active: boolean;
}

export default function Settings() {
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your business settings</p>
          </div>
        </div>

        <Tabs defaultValue="pay-rates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pay-rates">Pay Rates</TabsTrigger>
            <TabsTrigger value="crm-statuses">CRM Pipeline</TabsTrigger>
            <TabsTrigger value="quote-templates">Quote Templates</TabsTrigger>
            <TabsTrigger value="message-templates">Messages</TabsTrigger>
            <TabsTrigger value="terms-templates">Terms & Conditions</TabsTrigger>
          </TabsList>

          <TabsContent value="pay-rates">
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
              <div className="text-center py-8">Loading...</div>
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
                          {category.hourly_rate.toFixed(2)}/hr
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {category.description || "-"}
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
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this category?")) {
                                deleteCategory.mutate(category.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
          </TabsContent>

          <TabsContent value="crm-statuses">
            <Card>
              <CardContent className="pt-6">
                <CRMStatusesTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quote-templates">
            <Card>
              <CardContent className="pt-6">
                <QuoteTemplatesTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="message-templates">
            <Card>
              <CardContent className="pt-6">
                <MessageTemplatesTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms-templates">
            <Card>
              <CardContent className="pt-6">
                <TermsTemplatesTab />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
      </div>
    </DashboardLayout>
  );
}
