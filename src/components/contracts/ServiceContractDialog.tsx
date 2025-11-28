import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Upload, X, Copy } from "lucide-react";
import { format } from "date-fns";

interface ServiceContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  quoteId?: string;
}

interface LineItemFormData {
  description: string;
  quantity: number;
  unit_price: number;
  recurrence_frequency: string;
  first_generation_date: string;
  location_id: string;
  notes: string;
}

interface ContractFormData {
  customer_id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  billing_frequency: string;
  status: string;
  auto_generate: boolean;
  notes: string;
  line_items: LineItemFormData[];
}

export default function ServiceContractDialog({
  open,
  onOpenChange,
  customerId,
  quoteId,
}: ServiceContractDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", session?.user?.id)
        .single();
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const { register, handleSubmit, control, watch, setValue } = useForm<ContractFormData>({
    defaultValues: {
      customer_id: customerId || "",
      title: "",
      description: "",
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: "",
      billing_frequency: "monthly",
      status: "active",
      auto_generate: true,
      notes: "",
      line_items: [
        {
          description: "",
          quantity: 1,
          unit_price: 0,
          recurrence_frequency: "monthly",
          first_generation_date: format(new Date(), "yyyy-MM-dd"),
          location_id: "",
          notes: "",
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  const selectedCustomerId = watch("customer_id");
  const autoGenerate = watch("auto_generate");

  const { data: locations } = useQuery({
    queryKey: ["customer-locations", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const { data } = await supabase
        .from("customer_locations")
        .select("*")
        .eq("customer_id", selectedCustomerId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!selectedCustomerId,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ContractFormData) => {
    if (!profile?.tenant_id) {
      toast.error("Unable to determine tenant. Please refresh and try again.");
      return;
    }
    
    if (!session?.user?.id) {
      toast.error("Not authenticated. Please log in and try again.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Generate contract number
      const { data: latestContract } = await supabase
        .from("service_contracts")
        .select("contract_number")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastNumber = latestContract?.contract_number?.match(/\d+$/)?.[0] || "0";
      const newContractNumber = `SC-${String(parseInt(lastNumber) + 1).padStart(5, "0")}`;

      // Calculate total contract value
      const totalContractValue = data.line_items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
      );

      // Create contract
      const { data: newContract, error: contractError } = await supabase
        .from("service_contracts")
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: data.customer_id,
          contract_number: newContractNumber,
          title: data.title,
          description: data.description,
          start_date: data.start_date,
          end_date: data.end_date || null,
          billing_frequency: data.billing_frequency,
          status: data.status,
          auto_generate: data.auto_generate,
          total_contract_value: totalContractValue,
          notes: data.notes,
          quote_id: quoteId || null,
          created_by: session.user.id,
        })
        .select()
        .single();

      if (contractError) throw contractError;

      // Create line items
      const lineItemsToInsert = data.line_items.map((item, index) => ({
        contract_id: newContract.id,
        tenant_id: profile.tenant_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: 0,
        line_total: item.quantity * item.unit_price,
        recurrence_frequency: item.recurrence_frequency as any,
        first_generation_date: item.first_generation_date,
        next_generation_date: data.auto_generate ? item.first_generation_date : null,
        location_id: item.location_id || null,
        estimated_hours: null,
        notes: item.notes,
        item_order: index,
        is_active: true,
      }));

      const { error: lineItemsError } = await supabase
        .from("service_contract_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      // Upload files if any
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${profile.tenant_id}/${newContract.id}/${Date.now()}-${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from("contract-attachments")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("contract-attachments")
            .getPublicUrl(fileName);

          await supabase.from("service_contract_attachments").insert({
            tenant_id: profile.tenant_id,
            contract_id: newContract.id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: fileExt,
            file_size: file.size,
            uploaded_by: session.user.id,
          });
        }
      }

      toast.success("Service contract created successfully");
      queryClient.invalidateQueries({ queryKey: ["service-contracts"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Service Contract</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <Select
                value={watch("customer_id")}
                onValueChange={(value) => setValue("customer_id", value)}
                disabled={!!customerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" {...register("title")} required />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register("description")} rows={2} />
            </div>

            <div>
              <Label htmlFor="start_date">Start Date *</Label>
              <Input id="start_date" type="date" {...register("start_date")} required />
            </div>

            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input id="end_date" type="date" {...register("end_date")} />
            </div>

            <div>
              <Label htmlFor="billing_frequency">Billing Frequency</Label>
              <Select
                value={watch("billing_frequency")}
                onValueChange={(value) => setValue("billing_frequency", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={watch("status")} onValueChange={(value) => setValue("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <Switch
                id="auto_generate"
                checked={autoGenerate}
                onCheckedChange={(checked) => setValue("auto_generate", checked)}
              />
              <Label htmlFor="auto_generate">Automatically generate service orders</Label>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Line Items</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    description: "",
                    quantity: 1,
                    unit_price: 0,
                    recurrence_frequency: "monthly",
                    first_generation_date: format(new Date(), "yyyy-MM-dd"),
                    location_id: "",
                    notes: "",
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Line Item
              </Button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Item {index + 1}</h4>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const currentItem = watch(`line_items.${index}`);
                          append(currentItem);
                          toast.success("Line item duplicated");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Description *</Label>
                      <Input {...register(`line_items.${index}.description`)} required />
                    </div>

                    <div>
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`line_items.${index}.quantity`, { valueAsNumber: true })}
                        required
                      />
                    </div>

                    <div>
                      <Label>Unit Price *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`line_items.${index}.unit_price`, { valueAsNumber: true })}
                        required
                      />
                    </div>

                    <div>
                      <Label>Recurrence *</Label>
                      <Select
                        value={watch(`line_items.${index}.recurrence_frequency`)}
                        onValueChange={(value) =>
                          setValue(`line_items.${index}.recurrence_frequency`, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one_time">One Time</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="fortnightly">Fortnightly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="6_monthly">6 Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>First Generation Date *</Label>
                      <Input
                        type="date"
                        {...register(`line_items.${index}.first_generation_date`)}
                        required
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Location</Label>
                      <Select
                        value={watch(`line_items.${index}.location_id`)}
                        onValueChange={(value) => setValue(`line_items.${index}.location_id`, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations?.map((location: any) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2">
                      <Label>Notes</Label>
                      <Textarea {...register(`line_items.${index}.notes`)} rows={2} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label>Attachments</Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="flex-1"
                  id="file-upload"
                />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      Choose Files
                    </span>
                  </Button>
                </Label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-1">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={3} />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          <Button type="submit" disabled={isSubmitting || !profile?.tenant_id}>
            {isSubmitting ? "Creating..." : "Create Contract"}
          </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
