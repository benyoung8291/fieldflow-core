import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TeamOnboardingStepsProps {
  teamId: string;
  teamName: string;
}

const AVAILABLE_MODULES = [
  { value: "projects", label: "Projects" },
  { value: "service_orders", label: "Service Orders" },
  { value: "appointments", label: "Appointments" },
  { value: "field_reports", label: "Field Reports" },
  { value: "customers", label: "Customers" },
  { value: "contacts", label: "Contacts" },
  { value: "leads", label: "Leads" },
  { value: "quotes", label: "Quotes" },
  { value: "invoicing", label: "Invoicing" },
  { value: "expenses", label: "Expenses" },
  { value: "purchase_orders", label: "Purchase Orders" },
  { value: "inventory", label: "Inventory" },
  { value: "helpdesk", label: "Help Desk" },
];

export function TeamOnboardingSteps({ teamId, teamName }: TeamOnboardingStepsProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    module: "",
    route: "",
    content: "",
    step_order: 1,
  });
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: steps, isLoading } = useQuery({
    queryKey: ["onboarding-steps", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_onboarding_steps")
        .select("*")
        .eq("team_id", teamId)
        .order("step_order");
      
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  const createStepMutation = useMutation({
    mutationFn: async (stepData: any) => {
      const { error } = await supabase
        .from("team_onboarding_steps")
        .insert({
          ...stepData,
          team_id: teamId,
          tenant_id: profile!.tenant_id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
      toast.success("Onboarding step created successfully");
      resetForm();
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to create step: " + error.message);
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ id, ...stepData }: any) => {
      const { error } = await supabase
        .from("team_onboarding_steps")
        .update(stepData)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
      toast.success("Onboarding step updated successfully");
      resetForm();
      setEditingStep(null);
    },
    onError: (error) => {
      toast.error("Failed to update step: " + error.message);
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase
        .from("team_onboarding_steps")
        .delete()
        .eq("id", stepId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-steps"] });
      toast.success("Onboarding step deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete step: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      module: "",
      route: "",
      content: "",
      step_order: (steps?.length || 0) + 1,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingStep) {
      updateStepMutation.mutate({
        id: editingStep.id,
        ...formData,
      });
    } else {
      createStepMutation.mutate(formData);
    }
  };

  const handleEdit = (step: any) => {
    setEditingStep(step);
    setFormData({
      title: step.title,
      description: step.description || "",
      module: step.module,
      route: step.route || "",
      content: step.content || "",
      step_order: step.step_order,
    });
    setCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setEditingStep(null);
    resetForm();
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Onboarding Steps for {teamName}</CardTitle>
            <CardDescription>
              Configure the onboarding tutorial workflow for this team
            </CardDescription>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingStep ? "Edit Step" : "Create Onboarding Step"}</DialogTitle>
                <DialogDescription>
                  Define a step in the onboarding tutorial for this team
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Step Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Creating Your First Service Order"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="step_order">Step Order</Label>
                    <Input
                      id="step_order"
                      type="number"
                      value={formData.step_order}
                      onChange={(e) => setFormData({ ...formData, step_order: parseInt(e.target.value) })}
                      min={1}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Short Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of what this step teaches"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="module">Module</Label>
                    <Select value={formData.module} onValueChange={(value) => setFormData({ ...formData, module: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select module" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_MODULES.map((module) => (
                          <SelectItem key={module.value} value={module.value}>
                            {module.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="route">Route (Optional)</Label>
                    <Input
                      id="route"
                      value={formData.route}
                      onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                      placeholder="e.g., /service-orders"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="content">Tutorial Content (HTML supported)</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Detailed tutorial content with instructions..."
                    rows={6}
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingStep ? "Update Step" : "Create Step"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {steps?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No onboarding steps configured yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Route</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps?.map((step) => (
                <TableRow key={step.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{step.step_order}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{step.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {AVAILABLE_MODULES.find((m) => m.value === step.module)?.label || step.module}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {step.route || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(step)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete step "${step.title}"?`)) {
                            deleteStepMutation.mutate(step.id);
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
  );
}
