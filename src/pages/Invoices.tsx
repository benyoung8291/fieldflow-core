import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, FileText, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";

export default function Invoices() {
  const navigate = useNavigate();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [viewType, setViewType] = useState<"all" | "projects" | "service_orders">("all");
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()); // Stores document IDs for quick selection
  const [selectedLineItems, setSelectedLineItems] = useState<Set<string>>(new Set()); // Stores individual line item IDs
  const [invoiceNotes, setInvoiceNotes] = useState("");
  
  const queryClient = useQueryClient();

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch next invoice number
  const { data: nextInvoiceNumber } = useQuery({
    queryKey: ["next-invoice-number"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { data: setting } = await supabase
        .from("sequential_number_settings")
        .select("*")
        .eq("tenant_id", profile?.tenant_id)
        .eq("entity_type", "invoice")
        .single();

      if (!setting) return "INV-0001";
      
      const number = String(setting.next_number).padStart(setting.number_length, "0");
      return `${setting.prefix}${number}`;
    },
  });

  // Fetch projects for selected customer
  const { data: projects } = useQuery({
    queryKey: ["customer-projects", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, original_budget, revised_budget, created_at, customer_id")
        .eq("customer_id", selectedCustomerId)
        .order("created_at", { ascending: false });
      
      if (projectsError) throw projectsError;

      // Fetch line items for each project
      const projectsWithLineItems = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: lineItems, error: lineItemsError } = await supabase
            .from("project_line_items")
            .select("*")
            .eq("project_id", project.id)
            .is("parent_line_item_id", null)
            .order("item_order");
          
          if (lineItemsError) throw lineItemsError;
          return { ...project, project_line_items: lineItems };
        })
      );

      return projectsWithLineItems;
    },
    enabled: !!selectedCustomerId,
  });

  // Fetch service orders for selected customer
  const { data: serviceOrders } = useQuery({
    queryKey: ["customer-service-orders", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const { data: ordersData, error: ordersError } = await supabase
        .from("service_orders")
        .select("id, order_number, title, created_at, customer_id, work_order_number, purchase_order_number")
        .eq("customer_id", selectedCustomerId)
        .order("created_at", { ascending: false });
      
      if (ordersError) throw ordersError;

      // Fetch line items for each service order
      const ordersWithLineItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: lineItems, error: lineItemsError } = await supabase
            .from("service_order_line_items")
            .select("*")
            .eq("service_order_id", order.id)
            .order("item_order");
          
          if (lineItemsError) throw lineItemsError;
          return { ...order, service_order_line_items: lineItems };
        })
      );

      return ordersWithLineItems;
    },
    enabled: !!selectedCustomerId,
  });

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Collect selected line items
      const lineItems: any[] = [];
      let itemOrder = 0;
      const sourceDocuments = new Map<string, { type: string; id: string; allLineItemIds: string[]; selectedCount: number; totalLineItems: number }>();

      selectedLineItems.forEach((lineItemKey) => {
        const [sourceType, sourceId, lineItemId] = lineItemKey.split("|");
        
        if (sourceType === "project") {
          const project = projects?.find(p => p.id === sourceId);
          const item = project?.project_line_items?.find((li: any) => li.id === lineItemId);
          if (item) {
            lineItems.push({
              tenant_id: profile.tenant_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.sell_price || item.unit_price,
              line_total: item.line_total,
              item_order: itemOrder++,
              source_type: "project",
              source_id: sourceId,
              line_item_id: lineItemId,
            });
            
            // Track source document stats
            const key = `${sourceType}-${sourceId}`;
            if (!sourceDocuments.has(key)) {
              sourceDocuments.set(key, {
                type: sourceType,
                id: sourceId,
                allLineItemIds: project?.project_line_items?.map((li: any) => li.id) || [],
                selectedCount: 0,
                totalLineItems: project?.project_line_items?.length || 0,
              });
            }
            sourceDocuments.get(key)!.selectedCount++;
          }
        } else if (sourceType === "service_order") {
          const serviceOrder = serviceOrders?.find(so => so.id === sourceId);
          const item = serviceOrder?.service_order_line_items?.find((li: any) => li.id === lineItemId);
          if (item) {
            lineItems.push({
              tenant_id: profile.tenant_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
              item_order: itemOrder++,
              source_type: "service_order",
              source_id: sourceId,
              line_item_id: lineItemId,
            });
            
            // Track source document stats
            const key = `${sourceType}-${sourceId}`;
            if (!sourceDocuments.has(key)) {
              sourceDocuments.set(key, {
                type: sourceType,
                id: sourceId,
                allLineItemIds: serviceOrder?.service_order_line_items?.map((li: any) => li.id) || [],
                selectedCount: 0,
                totalLineItems: serviceOrder?.service_order_line_items?.length || 0,
              });
            }
            sourceDocuments.get(key)!.selectedCount++;
          }
        }
      });

      const subtotal = lineItems.reduce((sum, item) => sum + Number(item.line_total), 0);
      const taxRate = 0.1;
      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + taxAmount;

      // Determine if this is a progress invoice (any source document not 100% invoiced)
      const isProgressInvoice = Array.from(sourceDocuments.values()).some(
        doc => doc.selectedCount < doc.totalLineItems
      );

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: selectedCustomerId,
          invoice_number: nextInvoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          status: "draft",
          subtotal,
          tax_amount: taxAmount,
          tax_rate: taxRate,
          total_amount: totalAmount,
          notes: invoiceNotes || null,
          created_by: user.id,
          is_progress_invoice: isProgressInvoice,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItemsWithInvoiceId = lineItems.map(item => ({
        ...item,
        invoice_id: invoice.id,
      }));

      const { error: lineItemsError } = await supabase
        .from("invoice_line_items")
        .insert(lineItemsWithInvoiceId);

      if (lineItemsError) throw lineItemsError;

      // Update billing status for source documents
      for (const [key, doc] of sourceDocuments.entries()) {
        if (doc.type === "service_order") {
          // Check if 100% invoiced
          const status = doc.selectedCount === doc.totalLineItems ? "billed" : "partially_billed";
          await supabase
            .from("service_orders")
            .update({ billing_status: status })
            .eq("id", doc.id);
        } else if (doc.type === "project") {
          const status = doc.selectedCount === doc.totalLineItems ? "billed" : "partially_billed";
          await supabase
            .from("projects")
            .update({ billing_status: status })
            .eq("id", doc.id);
        }
      }

      // Update sequential number
      const { data: setting } = await supabase
        .from("sequential_number_settings")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("entity_type", "invoice")
        .single();

      if (setting) {
        await supabase
          .from("sequential_number_settings")
          .update({ next_number: setting.next_number + 1 })
          .eq("id", setting.id);
      }

      return invoice;
    },
    onSuccess: () => {
      toast.success("Invoice created successfully");
      queryClient.invalidateQueries({ queryKey: ["next-invoice-number"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customer-projects"] });
      queryClient.invalidateQueries({ queryKey: ["customer-service-orders"] });
      setSelectedItems(new Set());
      setSelectedLineItems(new Set());
      setInvoiceNotes("");
      setSelectedCustomerId("");
      navigate("/invoices");
    },
    onError: (error) => {
      toast.error("Failed to create invoice");
      console.error(error);
    },
  });

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    const newLineSelection = new Set(selectedLineItems);
    
    if (newSelection.has(itemId)) {
      // Deselect document and all its line items
      newSelection.delete(itemId);
      const dashIndex = itemId.indexOf("-");
      const type = itemId.substring(0, dashIndex);
      const id = itemId.substring(dashIndex + 1);
      
      // Remove all line items for this document
      selectedLineItems.forEach(lineKey => {
        if (lineKey.startsWith(`${type}|${id}|`)) {
          newLineSelection.delete(lineKey);
        }
      });
    } else {
      // Select document and all its line items
      newSelection.add(itemId);
      const dashIndex = itemId.indexOf("-");
      const type = itemId.substring(0, dashIndex);
      const id = itemId.substring(dashIndex + 1);
      
      if (type === "project") {
        const project = projects?.find(p => p.id === id);
        project?.project_line_items?.forEach((item: any) => {
          newLineSelection.add(`${type}|${id}|${item.id}`);
        });
      } else if (type === "service_order") {
        const order = serviceOrders?.find(so => so.id === id);
        order?.service_order_line_items?.forEach((item: any) => {
          newLineSelection.add(`${type}|${id}|${item.id}`);
        });
      }
    }
    
    setSelectedItems(newSelection);
    setSelectedLineItems(newLineSelection);
  };

  const toggleLineItemSelection = (sourceType: string, sourceId: string, lineItemId: string) => {
    const lineKey = `${sourceType}|${sourceId}|${lineItemId}`;
    const newLineSelection = new Set(selectedLineItems);
    
    if (newLineSelection.has(lineKey)) {
      newLineSelection.delete(lineKey);
    } else {
      newLineSelection.add(lineKey);
    }
    
    setSelectedLineItems(newLineSelection);
    
    // Update document selection state based on line items
    const docKey = `${sourceType}-${sourceId}`;
    const allLineItems = sourceType === "project"
      ? projects?.find(p => p.id === sourceId)?.project_line_items || []
      : serviceOrders?.find(so => so.id === sourceId)?.service_order_line_items || [];
    
    const selectedCount = allLineItems.filter((item: any) => 
      newLineSelection.has(`${sourceType}|${sourceId}|${item.id}`)
    ).length;
    
    const newDocSelection = new Set(selectedItems);
    if (selectedCount === allLineItems.length && allLineItems.length > 0) {
      newDocSelection.add(docKey);
    } else {
      newDocSelection.delete(docKey);
    }
    setSelectedItems(newDocSelection);
  };

  const calculateInvoiceTotal = () => {
    let subtotal = 0;

    selectedLineItems.forEach((lineKey) => {
      const [sourceType, sourceId, lineItemId] = lineKey.split("|");
      
      if (sourceType === "project") {
        const project = projects?.find(p => p.id === sourceId);
        const item = project?.project_line_items?.find((li: any) => li.id === lineItemId);
        if (item) subtotal += Number(item.line_total) || 0;
      } else if (sourceType === "service_order") {
        const order = serviceOrders?.find(so => so.id === sourceId);
        const item = order?.service_order_line_items?.find((li: any) => li.id === lineItemId);
        if (item) subtotal += Number(item.line_total) || 0;
      }
    });

    const taxRate = 0.1;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
  };

  const { subtotal, taxAmount, total } = calculateInvoiceTotal();

  const filteredProjects = viewType === "service_orders" ? [] : projects || [];
  const filteredServiceOrders = viewType === "projects" ? [] : serviceOrders || [];

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Invoices</h1>
          <p className="text-muted-foreground">Create and manage customer invoices</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel - Source Selection */}
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label>Select Customer</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a customer" />
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

              {selectedCustomerId && (
                <>
                  <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="projects">Projects</TabsTrigger>
                      <TabsTrigger value="service_orders">Service Orders</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredProjects.map((project) => {
                      const projectLineItems = project.project_line_items || [];
                      const selectedCount = projectLineItems.filter((item: any) => 
                        selectedLineItems.has(`project|${project.id}|${item.id}`)
                      ).length;
                      const allSelected = selectedCount === projectLineItems.length && projectLineItems.length > 0;
                      
                      return (
                        <div
                          key={project.id}
                          className={`p-4 border rounded-lg transition-colors ${
                            allSelected
                              ? "border-primary bg-primary/5"
                              : selectedCount > 0
                              ? "border-primary/50 bg-primary/5"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleItemSelection(`project-${project.id}`)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-foreground">{project.name}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {selectedCount} of {projectLineItems.length} line items selected
                              </div>
                              
                              {projectLineItems.length > 0 && (
                                <div className="mt-2 space-y-1 pl-2 border-l-2 border-muted">
                                  {projectLineItems.map((item: any) => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm">
                                      <Checkbox
                                        checked={selectedLineItems.has(`project|${project.id}|${item.id}`)}
                                        onCheckedChange={() => toggleLineItemSelection("project", project.id, item.id)}
                                      />
                                      <span className="flex-1 truncate text-muted-foreground">{item.description}</span>
                                      <span className="font-medium text-foreground">${(item.line_total || 0).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(`/projects/${project.id}`, '_blank')}
                              className="shrink-0"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredServiceOrders.map((order) => {
                      const orderLineItems = order.service_order_line_items || [];
                      const selectedCount = orderLineItems.filter((item: any) => 
                        selectedLineItems.has(`service_order|${order.id}|${item.id}`)
                      ).length;
                      const allSelected = selectedCount === orderLineItems.length && orderLineItems.length > 0;
                      
                      return (
                        <div
                          key={order.id}
                          className={`p-4 border rounded-lg transition-colors ${
                            allSelected
                              ? "border-primary bg-primary/5"
                              : selectedCount > 0
                              ? "border-primary/50 bg-primary/5"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleItemSelection(`service_order-${order.id}`)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">{order.order_number}</span>
                                <span className="font-medium text-foreground">{order.title}</span>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {selectedCount} of {orderLineItems.length} line items selected
                              </div>
                              
                              {orderLineItems.length > 0 && (
                                <div className="mt-2 space-y-1 pl-2 border-l-2 border-muted">
                                  {orderLineItems.map((item: any) => (
                                    <div key={item.id} className="flex items-center gap-2 text-sm">
                                      <Checkbox
                                        checked={selectedLineItems.has(`service_order|${order.id}|${item.id}`)}
                                        onCheckedChange={() => toggleLineItemSelection("service_order", order.id, item.id)}
                                      />
                                      <span className="flex-1 truncate text-muted-foreground">{item.description}</span>
                                      <span className="font-medium text-foreground">${(item.line_total || 0).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(`/service-orders/${order.id}`, '_blank')}
                              className="shrink-0"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Right Panel - Invoice Preview */}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">New Invoice</h2>
                <div className="text-sm text-muted-foreground">{nextInvoiceNumber}</div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="Add invoice notes..."
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">Line Items</div>
                  {selectedLineItems.size > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {selectedLineItems.size} {selectedLineItems.size === 1 ? 'item' : 'items'} selected
                    </div>
                  )}
                </div>
                {selectedLineItems.size === 0 ? (
                  <div className="text-sm text-muted-foreground py-12 text-center border rounded-lg bg-muted/20">
                    <div className="mb-2">👈 Select line items from projects or service orders</div>
                    <div>Use checkboxes to choose which items to invoice</div>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                            <th className="text-left p-2 font-medium text-muted-foreground w-28">Work Order #</th>
                            <th className="text-left p-2 font-medium text-muted-foreground w-24">PO #</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-20">Qty</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-24">Unit Price</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-28">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(selectedLineItems).reduce((acc, lineKey) => {
                            const [sourceType, sourceId, lineItemId] = lineKey.split("|");
                            
                            if (sourceType === "project") {
                              const project = projects?.find(p => p.id === sourceId);
                              const lineItem = project?.project_line_items?.find((li: any) => li.id === lineItemId);
                              if (!lineItem) return acc;
                              
                              // Add header if first item from this project
                              if (!acc.some((row: any) => row.key === `project-${sourceId}-header`)) {
                                acc.push(
                                  <tr key={`project-${sourceId}-header`} className="bg-muted/30">
                                    <td colSpan={6} className="p-2 text-xs font-medium text-muted-foreground">
                                      Project: {project?.name}
                                    </td>
                                  </tr>
                                );
                              }
                              
                              acc.push(
                                <tr key={lineItemId} className="border-b hover:bg-muted/10">
                                  <td className="p-2 text-foreground">{lineItem.description}</td>
                                  <td className="p-2 text-muted-foreground">-</td>
                                  <td className="p-2 text-muted-foreground">-</td>
                                  <td className="p-2 text-right text-foreground">{lineItem.quantity}</td>
                                  <td className="p-2 text-right text-foreground">
                                    ${(lineItem.unit_price || 0).toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-medium text-foreground">
                                    ${(lineItem.line_total || 0).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            } else if (sourceType === "service_order") {
                              const order = serviceOrders?.find(so => so.id === sourceId);
                              const lineItem = order?.service_order_line_items?.find((li: any) => li.id === lineItemId);
                              if (!lineItem) return acc;
                              
                              // Add header if first item from this order
                              if (!acc.some((row: any) => row.key === `service_order-${sourceId}-header`)) {
                                acc.push(
                                  <tr key={`service_order-${sourceId}-header`} className="bg-muted/30">
                                    <td colSpan={6} className="p-2 text-xs font-medium text-muted-foreground">
                                      {order?.order_number} - {order?.title}
                                    </td>
                                  </tr>
                                );
                              }
                              
                              acc.push(
                                <tr key={lineItemId} className="border-b hover:bg-muted/10">
                                  <td className="p-2 text-foreground">{lineItem.description}</td>
                                  <td className="p-2 text-foreground">{order?.work_order_number || '-'}</td>
                                  <td className="p-2 text-foreground">{order?.purchase_order_number || '-'}</td>
                                  <td className="p-2 text-right text-foreground">{lineItem.quantity}</td>
                                  <td className="p-2 text-right text-foreground">
                                    ${(lineItem.unit_price || 0).toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-medium text-foreground">
                                    ${(lineItem.line_total || 0).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            }
                            
                            return acc;
                          }, [] as JSX.Element[])}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (10%)</span>
                  <span className="font-medium text-foreground">${taxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-lg text-primary">${total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => createInvoiceMutation.mutate()}
                disabled={selectedLineItems.size === 0 || !selectedCustomerId || createInvoiceMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
