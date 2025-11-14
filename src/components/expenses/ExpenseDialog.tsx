import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X, AlertTriangle } from "lucide-react";
import { ChartOfAccountsSelector } from "./ChartOfAccountsSelector";
import { useExpensePolicyCheck } from "@/hooks/useExpensePolicyCheck";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: any;
  defaultValues?: Partial<{
    description: string;
    amount: number;
    expense_date: string;
  }>;
  onSuccess: (expenseId?: string) => void;
}

export function ExpenseDialog({ open, onOpenChange, expense, defaultValues, onSuccess }: ExpenseDialogProps) {
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    category_id: "",
    service_order_id: "",
    project_id: "",
    payment_method: "",
    reference_number: "",
    account_code: "",
    sub_account: "",
    notes: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const queryClient = useQueryClient();

  const { data: policyCheck } = useExpensePolicyCheck({
    amount: formData.amount ? parseFloat(formData.amount) : undefined,
    supplier_id: formData.supplier_id || undefined,
    category_id: formData.category_id || undefined,
    document_type: "expense",
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        description: expense.description || "",
        amount: expense.amount || "",
        expense_date: expense.expense_date || new Date().toISOString().split("T")[0],
        supplier_id: expense.supplier_id || "",
        category_id: expense.category_id || "",
        service_order_id: expense.service_order_id || "",
        project_id: expense.project_id || "",
        payment_method: expense.payment_method || "",
        reference_number: expense.reference_number || "",
        account_code: expense.account_code || "",
        sub_account: expense.sub_account || "",
        notes: expense.notes || "",
      });
    } else if (defaultValues) {
      setFormData(prev => ({
        ...prev,
        ...defaultValues,
        amount: defaultValues.amount?.toString() || prev.amount,
      }));
    }
  }, [expense, defaultValues]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: serviceOrders = [] } = useQuery({
    queryKey: ["service-orders-for-expense"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("service_orders")
        .select("id, work_order_number, customer:customers(name)")
        .eq("tenant_id", profile.tenant_id)
        .order("work_order_number", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-expense"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .order("name")
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { expenseId?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      let expenseId = expense?.id;

      if (expense) {
        const { error } = await supabase
          .from("expenses")
          .update({
            ...data,
            amount: parseFloat(data.amount),
            supplier_id: data.supplier_id || null,
            category_id: data.category_id || null,
            service_order_id: data.service_order_id || null,
            project_id: data.project_id || null,
          })
          .eq("id", expense.id)
          .eq("tenant_id", profile.tenant_id);

        if (error) throw error;
      } else {
        // Get next expense number
        const { data: numberSettings } = await supabase
          .from("sequential_number_settings")
          .select("next_number, prefix, number_length")
          .eq("tenant_id", profile.tenant_id)
          .eq("entity_type", "expense")
          .maybeSingle();

        let expenseNumber = "EXP-0001";
        if (numberSettings) {
          expenseNumber = `${numberSettings.prefix}${String(numberSettings.next_number).padStart(numberSettings.number_length, "0")}`;
          await supabase
            .from("sequential_number_settings")
            .update({ next_number: numberSettings.next_number + 1 })
            .eq("tenant_id", profile.tenant_id)
            .eq("entity_type", "expense");
        } else {
          await supabase.from("sequential_number_settings").insert({
            tenant_id: profile.tenant_id,
            entity_type: "expense",
            prefix: "EXP-",
            next_number: 2,
            number_length: 4,
          });
        }

        const { data: newExpense, error } = await supabase
          .from("expenses")
          .insert({
            ...data,
            tenant_id: profile.tenant_id,
            expense_number: expenseNumber,
            amount: parseFloat(data.amount),
            submitted_by: user.id,
            supplier_id: data.supplier_id || null,
            category_id: data.category_id || null,
            service_order_id: data.service_order_id || null,
            project_id: data.project_id || null,
          })
          .select()
          .single();

        if (error) throw error;
        expenseId = newExpense.id;
      }

      // Upload attachments
      if (selectedFiles.length > 0 && expenseId) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${expenseId}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("expense-receipts")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("expense-receipts")
            .getPublicUrl(fileName);

          await supabase.from("expense_attachments").insert({
            tenant_id: profile.tenant_id,
            expense_id: expenseId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          });
        }
      }

      return { expenseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(expense ? "Expense updated" : "Expense created");
      onSuccess(data?.expenseId);
      handleClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save expense");
    },
  });

  const handleClose = () => {
    setFormData({
      description: "",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      supplier_id: "",
      category_id: "",
      service_order_id: "",
      project_id: "",
      payment_method: "",
      reference_number: "",
      account_code: "",
      sub_account: "",
      notes: "",
    });
    setSelectedFiles([]);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check for blocking policy violations
    if (policyCheck?.isBlocked) {
      toast.error("Cannot submit expense due to policy violations");
      return;
    }

    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Create Expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {policyCheck?.hasViolations && (
            <Alert variant={policyCheck.isBlocked ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">
                    {policyCheck.isBlocked ? "Policy Violations (Blocked)" : "Policy Warnings"}
                  </p>
                  {policyCheck.violations.map((v, idx) => (
                    <p key={idx} className="text-sm">
                      • {v.rule_name}: {v.message}
                    </p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Description *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Supplier</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
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

            <div>
              <Label>Category</Label>
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

            <div>
              <Label>Service Order</Label>
              <Select
                value={formData.service_order_id}
                onValueChange={(value) => setFormData({ ...formData, service_order_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service order..." />
                </SelectTrigger>
                <SelectContent>
                  {serviceOrders.map((so: any) => (
                    <SelectItem key={so.id} value={so.id}>
                      {so.work_order_number} - {so.customer?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Project</Label>
              <Select
                value={formData.project_id}
                onValueChange={(value) => setFormData({ ...formData, project_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reference Number</Label>
              <Input
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <ChartOfAccountsSelector
                accountCode={formData.account_code}
                subAccount={formData.sub_account}
                onAccountChange={(value) => setFormData({ ...formData, account_code: value })}
                onSubAccountChange={(value) => setFormData({ ...formData, sub_account: value })}
              />
            </div>

            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="col-span-2">
              <Label>Attachments</Label>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)]);
                    }
                  }}
                />
                {selectedFiles.length > 0 && (
                  <div className="space-y-1">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">{file.name}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={saveMutation.isPending || policyCheck?.isBlocked}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
