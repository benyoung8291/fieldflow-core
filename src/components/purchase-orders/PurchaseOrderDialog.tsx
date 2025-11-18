import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Upload, AlertTriangle } from "lucide-react";
import { canApplyGST, isLineItemGSTFree, calculateDocumentTotals, getGSTWarning } from "@/lib/gstCompliance";
import { useExpensePolicyCheck } from "@/hooks/useExpensePolicyCheck";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

const formSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  po_number: z.string().min(1, "PO number is required"),
  po_date: z.string(),
  expected_delivery_date: z.string().optional().transform(val => val === "" ? undefined : val),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  tax_rate: z.number().min(0).max(100),
});

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  is_gst_free: boolean;
  notes?: string;
  source_type?: string;
  source_id?: string;
}

interface SourceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price?: number;
  cost_price?: number;
  line_total?: number;
}

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: any;
  onSuccess?: () => void;
  sourceLineItems?: SourceLineItem[];
  serviceOrderId?: string;
  projectId?: string;
}

export function PurchaseOrderDialog({ 
  open, 
  onOpenChange, 
  purchaseOrder, 
  onSuccess,
  sourceLineItems = [],
  serviceOrderId,
  projectId 
}: PurchaseOrderDialogProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [serviceOrders, setServiceOrders] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedSourceItems, setSelectedSourceItems] = useState<Set<string>>(new Set());
  const [hasPopulatedLineItems, setHasPopulatedLineItems] = useState(false);
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState<string | undefined>(serviceOrderId);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      supplier_id: "",
      po_number: "PO-",
      po_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: "",
      notes: "",
      internal_notes: "",
      tax_rate: 10,
    },
  });

  useEffect(() => {
    if (open) {
      fetchVendors();
      fetchServiceOrders();
      fetchProjects();
    } else {
      // Reset state when dialog closes
      setLineItems([]);
      setHasPopulatedLineItems(false);
      form.reset({
        supplier_id: "",
        po_number: "PO-",
        po_date: new Date().toISOString().split("T")[0],
        expected_delivery_date: "",
        notes: "",
        internal_notes: "",
        tax_rate: 10,
      });
    }
  }, [open, purchaseOrder]);

  const fetchNextPONumber = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) return;

      const { data, error } = await supabase.rpc("get_next_sequential_number", {
        p_tenant_id: profile.tenant_id,
        p_entity_type: "purchase_order",
      });

      if (error) throw error;
      if (data) {
        form.setValue("po_number", data);
      }
    } catch (error: any) {
      console.error("Failed to fetch next PO number:", error);
      toast.error("Failed to generate PO number");
    }
  };

  // Pre-populate line items when creating from service order
  useEffect(() => {
    if (open && !purchaseOrder && serviceOrderId && sourceLineItems.length > 0 && !hasPopulatedLineItems) {
      const importedItems: LineItem[] = sourceLineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.cost_price || 0,
        line_total: (item.cost_price || 0) * item.quantity,
        is_gst_free: false,
        notes: "",
      }));
      setLineItems(importedItems);
      setHasPopulatedLineItems(true);
    }
  }, [open, purchaseOrder, serviceOrderId, sourceLineItems, hasPopulatedLineItems]);

  useEffect(() => {
    const loadPurchaseOrderData = async () => {
      if (!purchaseOrder) return;
      
      form.reset({
        supplier_id: purchaseOrder.supplier_id,
        po_number: purchaseOrder.po_number,
        po_date: purchaseOrder.po_date,
        expected_delivery_date: purchaseOrder.expected_delivery_date || "",
        notes: purchaseOrder.notes || "",
        internal_notes: purchaseOrder.internal_notes || "",
        tax_rate: purchaseOrder.tax_rate || 10,
      });
      
      fetchSupplierDetails(purchaseOrder.supplier_id);
      
      // Fetch line items
      try {
        // @ts-ignore - Supabase type generation issue
        const { data: items, error: itemsError } = await supabase
          .from("purchase_order_line_items")
          .select("*")
          .eq("po_id", purchaseOrder.id)
          .order("item_order");

        if (itemsError) throw itemsError;
        
        if (items) {
          const lineItemsData: LineItem[] = items.map((item: any) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
            is_gst_free: item.is_gst_free || false,
            notes: item.notes || "",
          }));
          
          setLineItems(lineItemsData);
        }
      } catch (error: any) {
        console.error("Failed to fetch line items:", error);
        toast.error("Failed to load line items");
      }
    };
    
    loadPurchaseOrderData();
  }, [purchaseOrder]);

  const fetchVendors = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Supplier fetch error:", error);
      toast.error("Failed to load suppliers: " + error.message);
      return;
    }
    console.log("Loaded suppliers:", data);
    setSuppliers(data || []);
  };

  const fetchServiceOrders = async () => {
    const { data, error } = await supabase
      .from("service_orders")
      .select("*, customers(name)")
      .in("status", ["draft", "scheduled", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setServiceOrders(data);
    }
  };

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*, customers(name)")
      .in("status", ["planning", "active", "on_hold"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setProjects(data);
    }
  };

  const fetchSupplierDetails = async (supplierId: string) => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("gst_registered")
      .eq("id", supplierId)
      .single();

    if (error) {
      toast.error("Failed to load supplier details");
      return;
    }
    setSelectedVendor(data);
    
    const warning = getGSTWarning(data);
    if (warning) {
      toast.warning(warning);
    }

    // Update all line items to GST-free if supplier is not GST registered
    if (!canApplyGST(data)) {
      setLineItems(prev => prev.map(item => ({ ...item, is_gst_free: true })));
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    form.setValue("supplier_id", supplierId);
    fetchSupplierDetails(supplierId);
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      description: "",
      quantity: 1,
      unit_price: 0,
      line_total: 0,
      is_gst_free: !canApplyGST(selectedVendor),
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate line total
    if (field === "quantity" || field === "unit_price") {
      updated[index].line_total = updated[index].quantity * updated[index].unit_price;
    }

    // Enforce GST-free if supplier is not registered
    if (field === "is_gst_free" && !canApplyGST(selectedVendor)) {
      updated[index].is_gst_free = true;
      toast.warning("This supplier is not GST registered and cannot charge GST");
    }

    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const importFromServiceOrder = async (serviceOrderId: string) => {
    const { data, error } = await supabase
      .from("service_order_line_items")
      .select("*")
      .eq("service_order_id", serviceOrderId)
      .order("item_order");

    if (error) {
      toast.error("Failed to import line items");
      return;
    }

    const imported: LineItem[] = (data || []).map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price || 0,
      line_total: item.line_total || 0,
      is_gst_free: !canApplyGST(selectedVendor),
      notes: item.notes || "",
      source_type: "service_order",
      source_id: serviceOrderId,
    }));

    setLineItems([...lineItems, ...imported]);
    setImportOpen(false);
    toast.success(`Imported ${imported.length} line items`);
  };

  const importFromProject = async (projectId: string) => {
    const { data, error } = await supabase
      .from("project_line_items")
      .select("*")
      .eq("project_id", projectId)
      .order("item_order");

    if (error) {
      toast.error("Failed to import line items");
      return;
    }

    const imported: LineItem[] = (data || []).map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.cost_price || item.unit_price || 0,
      line_total: item.line_total || 0,
      is_gst_free: !canApplyGST(selectedVendor),
      notes: item.notes || "",
      source_type: "project",
      source_id: projectId,
    }));

    setLineItems([...lineItems, ...imported]);
    setImportOpen(false);
    toast.success(`Imported ${imported.length} line items`);
  };

  const totals = calculateDocumentTotals(
    lineItems.map(item => ({
      line_total: item.line_total,
      is_gst_free: item.is_gst_free,
    })),
    form.watch("tax_rate"),
    selectedVendor
  );

  const { data: policyCheck } = useExpensePolicyCheck({
    amount: totals?.total,
    supplier_id: form.watch("supplier_id") || undefined,
    category_id: undefined,
    document_type: "purchase_order",
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (lineItems.length === 0) {
      toast.error("Add at least one line item");
      return;
    }

    // Check for blocking policy violations
    if (policyCheck?.isBlocked) {
      toast.error("Cannot submit purchase order due to policy violations");
      return;
    }

    setLoading(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      const poData = {
        ...values,
        expected_delivery_date: values.expected_delivery_date || null,
        tenant_id: profile?.tenant_id,
        created_by: (await supabase.auth.getUser()).data.user?.id,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        status: "draft",
      };

      let poId: string;

      if (purchaseOrder) {
        const { error } = await supabase
          .from("purchase_orders")
          .update({
            supplier_id: poData.supplier_id,
            po_number: poData.po_number,
            po_date: poData.po_date,
            expected_delivery_date: poData.expected_delivery_date || null,
            notes: poData.notes,
            internal_notes: poData.internal_notes,
            tax_rate: poData.tax_rate,
            subtotal: poData.subtotal,
            tax_amount: poData.tax_amount,
            total_amount: poData.total_amount,
            service_order_id: selectedServiceOrderId ?? purchaseOrder.service_order_id ?? null,
            project_id: selectedProjectId ?? purchaseOrder.project_id ?? null,
          })
          .eq("id", purchaseOrder.id);

        if (error) throw error;
        poId = purchaseOrder.id;

        // Delete existing line items
        await supabase
          .from("purchase_order_line_items")
          .delete()
          .eq("po_id", poId);
      } else {
        // Generate next PO number
        const { data: settings } = await supabase
          .from("sequential_number_settings")
          .select("*")
          .eq("tenant_id", profile?.tenant_id)
          .eq("entity_type", "purchase_order")
          .single();

        const nextNum = settings?.next_number || 1;
        const poNumber = (settings?.prefix || "PO-") + String(nextNum).padStart(settings?.number_length || 6, "0");

        // Use database function to bypass schema cache issues
        const { data: poId, error: insertError } = await supabase
          .rpc('create_purchase_order_with_linkage', {
            p_tenant_id: profile?.tenant_id,
            p_supplier_id: poData.supplier_id,
            p_po_number: poNumber,
            p_po_date: poData.po_date,
            p_expected_delivery_date: poData.expected_delivery_date,
            p_notes: poData.notes || '',
            p_internal_notes: poData.internal_notes || '',
            p_tax_rate: poData.tax_rate,
            p_subtotal: poData.subtotal,
            p_tax_amount: poData.tax_amount,
            p_total_amount: poData.total_amount,
            p_created_by: poData.created_by,
            p_status: 'draft',
            p_service_order_id: selectedServiceOrderId || null,
            p_project_id: selectedProjectId || null
          });

        if (insertError) throw insertError;
        if (!poId) throw new Error("Failed to create PO");

        // Update the sequential number
        await supabase
          .from("sequential_number_settings")
          .update({ next_number: nextNum + 1 })
          .eq("tenant_id", profile?.tenant_id)
          .eq("entity_type", "purchase_order");
      }

      // Insert line items
      const lineItemsData = lineItems.map((item, index) => ({
        po_id: poId,
        tenant_id: profile?.tenant_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        is_gst_free: item.is_gst_free,
        notes: item.notes || "",
        item_order: index,
      }));

      const { error: lineItemsError } = await supabase
        .from("purchase_order_line_items")
        .insert(lineItemsData);

      if (lineItemsError) throw lineItemsError;

      toast.success(purchaseOrder ? "Purchase order updated" : "Purchase order created");
      
      // Reset form state before closing
      form.reset();
      setLineItems([]);
      setHasPopulatedLineItems(false);
      setSelectedVendor(null);
      
      // Close dialog and trigger success callback
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("PO creation error:", error);
      toast.error(error.message || "Failed to save purchase order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{purchaseOrder ? "Edit" : "Create"} Purchase Order</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Supplier *</FormLabel>
                    <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? suppliers.find((v) => v.id === field.value)?.name
                              : "Select supplier"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0">
                        <Command>
                          <CommandInput placeholder="Search suppliers..." />
                          <CommandEmpty>No supplier found.</CommandEmpty>
                          <CommandGroup>
                            {suppliers.map((supplier) => (
                              <CommandItem
                                key={supplier.id}
                                value={supplier.name}
                                onSelect={() => {
                                  handleSupplierChange(supplier.id);
                                  setSupplierOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    supplier.id === field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex items-center gap-2">
                                  {supplier.name}
                                  {supplier.gst_registered && (
                                    <Badge variant="outline" className="text-xs">GST Reg</Badge>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Service Order and Project selectors - only show when not pre-linked */}
              {!serviceOrderId && !projectId && (
                <>
                  <div className="col-span-2">
                    <FormLabel>Link to Service Order (Optional)</FormLabel>
                    <Select 
                      value={selectedServiceOrderId} 
                      onValueChange={(value) => {
                        setSelectedServiceOrderId(value || undefined);
                        if (value) setSelectedProjectId(undefined); // Clear project if SO selected
                      }}
                      disabled={!!selectedProjectId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service order..." />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceOrders.map((so) => (
                          <SelectItem key={so.id} value={so.id}>
                            {so.order_number} - {so.customers?.name || "N/A"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <FormLabel>Link to Project (Optional)</FormLabel>
                    <Select 
                      value={selectedProjectId} 
                      onValueChange={(value) => {
                        setSelectedProjectId(value || undefined);
                        if (value) setSelectedServiceOrderId(undefined); // Clear SO if project selected
                      }}
                      disabled={!!selectedServiceOrderId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select project..." />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name} - {project.customers?.name || "N/A"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* PO Number is auto-generated and hidden */}

              <FormField
                control={form.control}
                name="po_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expected_delivery_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Delivery Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {selectedVendor && !canApplyGST(selectedVendor) && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning rounded-md">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm text-warning">
                  This supplier is not GST registered. All line items will be GST-free.
                </span>
              </div>
            )}

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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Line Items</h3>
                <div className="flex gap-2">
                  <Popover open={importOpen} onOpenChange={setImportOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Import
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-4">
                        <h4 className="font-semibold">Import Line Items</h4>
                        
                        {serviceOrders.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">From Service Order</label>
                            <Select onValueChange={importFromServiceOrder}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select service order" />
                              </SelectTrigger>
                              <SelectContent>
                                {serviceOrders.map((so) => (
                                  <SelectItem key={so.id} value={so.id}>
                                    {so.work_order_number} - {so.customers?.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {projects.length > 0 && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">From Project</label>
                            <Select onValueChange={importFromProject}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select project" />
                              </SelectTrigger>
                              <SelectContent>
                                {projects.map((proj) => (
                                  <SelectItem key={proj.id} value={proj.id}>
                                    {proj.project_name} - {proj.customers?.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button type="button" onClick={addLineItem} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>

              {lineItems.length > 0 ? (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Description</TableHead>
                        <TableHead className="w-[10%]">Qty</TableHead>
                        <TableHead className="w-[15%]">Unit Price</TableHead>
                        <TableHead className="w-[15%]">Total</TableHead>
                        <TableHead className="w-[10%]">GST Free</TableHead>
                        <TableHead className="w-[10%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(index, "description", e.target.value)}
                              placeholder="Item description"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                            />
                          </TableCell>
                          <TableCell>
                            {formatCurrency(item.line_total)}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={item.is_gst_free}
                              onCheckedChange={(checked) => updateLineItem(index, "is_gst_free", checked)}
                              disabled={!canApplyGST(selectedVendor)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                  No line items added yet
                </div>
              )}

              <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.gstFreeAmount > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>GST Free Amount:</span>
                      <span>{formatCurrency(totals.gstFreeAmount)}</span>
                    </div>
                  )}
                  {totals.taxableAmount > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Taxable Amount:</span>
                      <span>{formatCurrency(totals.taxableAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>GST ({form.watch("tax_rate")}%):</span>
                    <span>{formatCurrency(totals.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Total:</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="internal_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || policyCheck?.isBlocked}
              >
                {loading ? "Saving..." : purchaseOrder ? "Update" : "Create"} Purchase Order
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
