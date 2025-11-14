import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

interface PolicyRule {
  id: string;
  rule_name: string;
  rule_type: string;
  is_active: boolean;
  max_amount: number | null;
  supplier_id: string | null;
  category_id: string | null;
  applies_to: string;
  violation_action: string;
  supplier?: { name: string };
  category?: { name: string };
}

export function ExpensePolicyTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<PolicyRule | null>(null);
  const [formData, setFormData] = useState({
    rule_name: "",
    rule_type: "max_amount",
    max_amount: "",
    supplier_id: "",
    category_id: "",
    applies_to: "both",
    violation_action: "flag",
    is_active: true,
  });

  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["expense-policy-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_policy_rules")
        .select(`
          *,
          supplier:suppliers!supplier_id(name),
          category:expense_categories(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PolicyRule[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-for-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const ruleData = {
        tenant_id: profile.tenant_id,
        rule_name: data.rule_name,
        rule_type: data.rule_type,
        max_amount: data.rule_type === "max_amount" ? parseFloat(data.max_amount) : null,
        supplier_id: data.rule_type === "restricted_vendor" ? data.supplier_id : null,
        category_id: data.rule_type === "prohibited_category" ? data.category_id : null,
        applies_to: data.applies_to,
        violation_action: data.violation_action,
        is_active: data.is_active,
      };

      if (selectedRule) {
        const { error } = await supabase
          .from("expense_policy_rules")
          .update(ruleData)
          .eq("id", selectedRule.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("expense_policy_rules")
          .insert(ruleData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-policy-rules"] });
      toast.success(selectedRule ? "Policy rule updated" : "Policy rule created");
      handleDialogClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save policy rule");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("expense_policy_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-policy-rules"] });
      toast.success("Policy rule deleted");
    },
    onError: () => {
      toast.error("Failed to delete policy rule");
    },
  });

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedRule(null);
    setFormData({
      rule_name: "",
      rule_type: "max_amount",
      max_amount: "",
      supplier_id: "",
      category_id: "",
      applies_to: "both",
      violation_action: "flag",
      is_active: true,
    });
  };

  const handleEdit = (rule: PolicyRule) => {
    setSelectedRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      rule_type: rule.rule_type,
      max_amount: rule.max_amount?.toString() || "",
      supplier_id: rule.supplier_id || "",
      category_id: rule.category_id || "",
      applies_to: rule.applies_to,
      violation_action: rule.violation_action,
      is_active: rule.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case "max_amount": return "Max Amount";
      case "restricted_vendor": return "Restricted Supplier";
      case "prohibited_category": return "Prohibited Category";
      default: return type;
    }
  };

  const getAppliesToLabel = (appliesTo: string) => {
    switch (appliesTo) {
      case "expenses": return "Expenses Only";
      case "purchase_orders": return "Purchase Orders Only";
      case "both": return "Both";
      default: return appliesTo;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Expense Policy Rules</h3>
          <p className="text-sm text-muted-foreground">
            Configure rules to flag or block out-of-policy expenses and purchase orders
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No policy rules configured
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Constraint</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{rule.rule_name}</TableCell>
                <TableCell>{getRuleTypeLabel(rule.rule_type)}</TableCell>
                <TableCell>
                  {rule.rule_type === "max_amount" && `$${rule.max_amount}`}
                  {rule.rule_type === "restricted_vendor" && rule.supplier?.name}
                  {rule.rule_type === "prohibited_category" && rule.category?.name}
                </TableCell>
                <TableCell>{getAppliesToLabel(rule.applies_to)}</TableCell>
                <TableCell>
                  <Badge variant={rule.violation_action === "block" ? "destructive" : "secondary"}>
                    {rule.violation_action === "block" ? "Block" : "Flag"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={rule.is_active ? "default" : "secondary"}>
                    {rule.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this policy rule?")) {
                          deleteMutation.mutate(rule.id);
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

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedRule ? "Edit" : "Create"} Policy Rule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Rule Name *</Label>
              <Input
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                placeholder="e.g., Daily expense limit"
                required
              />
            </div>

            <div>
              <Label>Rule Type *</Label>
              <Select
                value={formData.rule_type}
                onValueChange={(value) => setFormData({ ...formData, rule_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="max_amount">Max Amount</SelectItem>
                  <SelectItem value="restricted_vendor">Restricted Supplier</SelectItem>
                  <SelectItem value="prohibited_category">Prohibited Category</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.rule_type === "max_amount" && (
              <div>
                <Label>Maximum Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.max_amount}
                  onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            )}

            {formData.rule_type === "restricted_vendor" && (
              <div>
                <Label>Supplier *</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.rule_type === "prohibited_category" && (
              <div>
                <Label>Category *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Applies To *</Label>
              <Select
                value={formData.applies_to}
                onValueChange={(value) => setFormData({ ...formData, applies_to: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="expenses">Expenses Only</SelectItem>
                  <SelectItem value="purchase_orders">Purchase Orders Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Violation Action *</Label>
              <Select
                value={formData.violation_action}
                onValueChange={(value) => setFormData({ ...formData, violation_action: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flag">Flag (Warning)</SelectItem>
                  <SelectItem value="block">Block (Prevent Submission)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Active</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
