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
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
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
        .select("id, order_number, title, created_at, customer_id")
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

      // Collect all line items from selected projects/service orders
      const lineItems: any[] = [];
      let itemOrder = 0;

      selectedItems.forEach((itemId) => {
        const [type, id] = itemId.split("-");
        
        if (type === "project") {
          const project = projects?.find(p => p.id === id);
          project?.project_line_items?.forEach((item: any) => {
            lineItems.push({
              tenant_id: profile.tenant_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.sell_price || item.unit_price,
              line_total: item.line_total,
              item_order: itemOrder++,
              source_type: "project",
              source_id: id,
            });
          });
        } else if (type === "service_order") {
          const serviceOrder = serviceOrders?.find(so => so.id === id);
          serviceOrder?.service_order_line_items?.forEach((item: any) => {
            lineItems.push({
              tenant_id: profile.tenant_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.sell_price || item.unit_price,
              line_total: item.line_total,
              item_order: itemOrder++,
              source_type: "service_order",
              source_id: id,
            });
          });
        }
      });

      const subtotal = lineItems.reduce((sum, item) => sum + Number(item.line_total), 0);
      const taxRate = 0.1; // 10% tax - should be configurable
      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + taxAmount;

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
      setSelectedItems(new Set());
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
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const calculateInvoiceTotal = () => {
    let subtotal = 0;

    selectedItems.forEach((itemId) => {
      const [type, id] = itemId.split("-");
      
      if (type === "project") {
        const project = projects?.find(p => p.id === id);
        project?.project_line_items?.forEach((item: any) => {
          subtotal += Number(item.line_total) || 0;
        });
      } else if (type === "service_order") {
        const serviceOrder = serviceOrders?.find(so => so.id === id);
        serviceOrder?.service_order_line_items?.forEach((item: any) => {
          subtotal += Number(item.line_total) || 0;
        });
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
                    {filteredProjects.map((project) => (
                      <div
                        key={project.id}
                        className={`p-4 border rounded-lg transition-colors ${
                          selectedItems.has(`project-${project.id}`)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => toggleItemSelection(`project-${project.id}`)}
                          >
                            <div className="font-medium text-foreground">{project.name}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {project.project_line_items?.length || 0} line items
                            </div>
                            <div className="text-sm font-medium text-primary mt-1">
                              ${project.revised_budget || project.original_budget || 0}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/projects/${project.id}`, '_blank');
                            }}
                            className="shrink-0"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {filteredServiceOrders.map((order) => (
                      <div
                        key={order.id}
                        className={`p-4 border rounded-lg transition-colors ${
                          selectedItems.has(`service_order-${order.id}`)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => toggleItemSelection(`service_order-${order.id}`)}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">{order.order_number}</span>
                                <span className="font-medium text-foreground">{order.title}</span>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {order.service_order_line_items?.length || 0} line items
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/service-orders/${order.id}`, '_blank');
                            }}
                            className="shrink-0"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
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
                <div className="text-sm font-medium text-foreground">Line Items</div>
                {selectedItems.size === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    No items selected. Choose projects or service orders from the left panel.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr className="border-b">
                            <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-20">Qty</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-24">Unit Price</th>
                            <th className="text-right p-2 font-medium text-muted-foreground w-28">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(selectedItems).map((itemId) => {
                            const [type, id] = itemId.split("-");
                            
                            if (type === "project") {
                              const project = projects?.find(p => p.id === id);
                              return (
                                <>
                                  <tr key={`${itemId}-header`} className="bg-muted/30">
                                    <td colSpan={4} className="p-2 text-xs font-medium text-muted-foreground">
                                      Project: {project?.name}
                                    </td>
                                  </tr>
                                  {project?.project_line_items?.map((lineItem: any, idx: number) => (
                                    <tr key={lineItem.id} className="border-b hover:bg-muted/10">
                                      <td className="p-2 text-foreground">{lineItem.description}</td>
                                      <td className="p-2 text-right text-foreground">{lineItem.quantity}</td>
                                      <td className="p-2 text-right text-foreground">
                                        ${(lineItem.sell_price || lineItem.unit_price || 0).toFixed(2)}
                                      </td>
                                      <td className="p-2 text-right font-medium text-foreground">
                                        ${(lineItem.line_total || 0).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </>
                              );
                              } else {
                              const order = serviceOrders?.find(so => so.id === id);
                              return (
                                <>
                                  <tr key={`${itemId}-header`} className="bg-muted/30">
                                    <td colSpan={4} className="p-2 text-xs font-medium text-muted-foreground">
                                      {order?.order_number} - {order?.title}
                                    </td>
                                  </tr>
                                  {order?.service_order_line_items && order.service_order_line_items.length > 0 ? (
                                    order.service_order_line_items.map((lineItem: any) => (
                                      <tr key={lineItem.id} className="border-b hover:bg-muted/10">
                                        <td className="p-2 text-foreground">{lineItem.description}</td>
                                        <td className="p-2 text-right text-foreground">{lineItem.quantity}</td>
                                        <td className="p-2 text-right text-foreground">
                                          ${(lineItem.sell_price || lineItem.unit_price || 0).toFixed(2)}
                                        </td>
                                        <td className="p-2 text-right font-medium text-foreground">
                                          ${(lineItem.line_total || 0).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr key={itemId} className="border-b">
                                      <td className="p-2 text-muted-foreground italic" colSpan={4}>
                                        No line items available
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            }
                          })}
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
                disabled={selectedItems.size === 0 || !selectedCustomerId || createInvoiceMutation.isPending}
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
