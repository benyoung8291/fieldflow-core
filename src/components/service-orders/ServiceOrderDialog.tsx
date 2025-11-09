import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import FieldPresenceWrapper from "@/components/presence/FieldPresenceWrapper";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import RemoteCursors from "@/components/presence/RemoteCursors";
import { usePresence } from "@/hooks/usePresence";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  item_order: number;
  notes?: string;
}

interface ServiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string;
}

export default function ServiceOrderDialog({ 
  open, 
  onOpenChange, 
  orderId,
}: ServiceOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [currentField, setCurrentField] = useState<string>("");
  
  const { onlineUsers, updateField, updateCursorPosition } = usePresence({
    page: "service-order-dialog",
    field: currentField,
  });

  useEffect(() => {
    if (!open) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateCursorPosition(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [open, updateCursorPosition]);
  
  const [formData, setFormData] = useState({
    customer_id: "",
    customer_location_id: "",
    customer_contact_id: "",
    project_id: "",
    title: "",
    description: "",
    work_order_number: "",
    purchase_order_number: "",
    status: "draft",
    priority: "normal",
    skill_required: "",
    preferred_date: "",
    preferred_date_start: "",
    preferred_date_end: "",
    tax_rate: "10",
  });

  useEffect(() => {
    if (open) {
      fetchCustomers();
      if (orderId) {
        fetchOrder();
      } else {
        resetForm();
      }
    }
  }, [open, orderId]);

  useEffect(() => {
    if (formData.customer_id) {
      fetchCustomerRelatedData(formData.customer_id);
    } else {
      setLocations([]);
      setContacts([]);
      setProjects([]);
    }
  }, [formData.customer_id]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    if (error) {
      toast({ title: "Error fetching customers", variant: "destructive" });
    } else {
      setCustomers(data || []);
    }
  };

  const fetchCustomerRelatedData = async (customerId: string) => {
    // Fetch locations
    const { data: locationsData, error: locError } = await supabase
      .from("customer_locations")
      .select("id, name, address")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .order("name");
    
    if (!locError) setLocations(locationsData || []);

    // Fetch contacts
    const { data: contactsData, error: conError } = await supabase
      .from("customer_contacts")
      .select("id, first_name, last_name, email, phone")
      .eq("customer_id", customerId)
      .order("first_name");
    
    if (!conError) setContacts(contactsData || []);

    // Fetch projects
    const { data: projectsData, error: projError } = await supabase
      .from("projects")
      .select("id, name")
      .eq("customer_id", customerId)
      .order("name");
    
    if (!projError) setProjects(projectsData || []);
  };

  const fetchOrder = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_orders")
      .select("*, service_order_line_items(*)")
      .eq("id", orderId)
      .single();
    
    if (error) {
      toast({ title: "Error fetching order", variant: "destructive" });
    } else if (data) {
      setFormData({
        customer_id: data.customer_id || "",
        customer_location_id: data.customer_location_id || "",
        customer_contact_id: data.customer_contact_id || "",
        project_id: data.project_id || "",
        title: data.title || "",
        description: data.description || "",
        work_order_number: data.work_order_number || "",
        purchase_order_number: data.purchase_order_number || "",
        status: data.status || "draft",
        priority: data.priority || "normal",
        skill_required: data.skill_required || "",
        preferred_date: data.preferred_date || "",
        preferred_date_start: data.preferred_date_start || "",
        preferred_date_end: data.preferred_date_end || "",
        tax_rate: data.tax_rate?.toString() || "10",
      });

      if (data.service_order_line_items) {
        setLineItems(
          data.service_order_line_items
            .sort((a: any, b: any) => a.item_order - b.item_order)
            .map((item: any) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
              item_order: item.item_order,
              notes: item.notes,
            }))
        );
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      customer_id: "",
      customer_location_id: "",
      customer_contact_id: "",
      project_id: "",
      title: "",
      description: "",
      work_order_number: "",
      purchase_order_number: "",
      status: "draft",
      priority: "normal",
      skill_required: "",
      preferred_date: "",
      preferred_date_start: "",
      preferred_date_end: "",
      tax_rate: "10",
    });
    setLineItems([]);
    setProjects([]);
    setLocations([]);
    setContacts([]);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        line_total: 0,
        item_order: lineItems.length,
      },
    ]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate line total
    if (field === "quantity" || field === "unit_price") {
      const qty = field === "quantity" ? parseFloat(value) || 0 : updated[index].quantity;
      const price = field === "unit_price" ? parseFloat(value) || 0 : updated[index].unit_price;
      updated[index].line_total = qty * price;
    }
    
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const taxRate = parseFloat(formData.tax_rate) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Not authenticated", variant: "destructive" });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const totals = calculateTotals();

      const orderData: any = {
        customer_id: formData.customer_id,
        customer_location_id: formData.customer_location_id || null,
        customer_contact_id: formData.customer_contact_id || null,
        project_id: formData.project_id || null,
        title: formData.title,
        description: formData.description,
        work_order_number: formData.work_order_number || null,
        purchase_order_number: formData.purchase_order_number || null,
        status: formData.status,
        priority: formData.priority,
        skill_required: formData.skill_required || null,
        preferred_date: formData.preferred_date || null,
        preferred_date_start: formData.preferred_date_start || null,
        preferred_date_end: formData.preferred_date_end || null,
        billing_type: "fixed",
        fixed_amount: totals.total,
        subtotal: totals.subtotal,
        tax_rate: parseFloat(formData.tax_rate),
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
      };

      if (!orderId) {
        orderData.created_by = user.id;
        orderData.order_number = `SO-${Date.now()}`;
      }

      let savedOrderId = orderId;

      if (orderId) {
        const { error } = await supabase
          .from("service_orders")
          .update(orderData)
          .eq("id", orderId);

        if (error) throw error;

        // Delete existing line items
        await supabase
          .from("service_order_line_items")
          .delete()
          .eq("service_order_id", orderId);
      } else {
        const { data: newOrder, error } = await supabase
          .from("service_orders")
          .insert([orderData])
          .select()
          .single();

        if (error) throw error;
        savedOrderId = newOrder.id;
      }

      // Insert line items
      if (lineItems.length > 0) {
        const lineItemsData = lineItems.map((item, index) => ({
          service_order_id: savedOrderId,
          tenant_id: profile?.tenant_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          item_order: index,
          notes: item.notes || null,
        }));

        const { error: lineError } = await supabase
          .from("service_order_line_items")
          .insert(lineItemsData);

        if (lineError) throw lineError;
      }

      toast({ title: orderId ? "Service order updated successfully" : "Service order created successfully" });
      queryClient.invalidateQueries({ queryKey: ["service_orders"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Error saving order", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <RemoteCursors users={onlineUsers} />
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{orderId ? "Edit" : "Create"} Service Order</DialogTitle>
            <PresenceIndicator users={onlineUsers} />
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FieldPresenceWrapper fieldName="customer_id" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="customer_id">Customer *</Label>
                <Select 
                  value={formData.customer_id} 
                  onValueChange={(value) => {
                    setFormData({ 
                      ...formData, 
                      customer_id: value, 
                      customer_location_id: "",
                      customer_contact_id: "",
                      project_id: "" 
                    });
                    setCurrentField("customer_id");
                    updateField("customer_id");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FieldPresenceWrapper>

            <FieldPresenceWrapper fieldName="customer_location_id" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="customer_location_id">Location</Label>
                <Select 
                  value={formData.customer_location_id} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, customer_location_id: value });
                    setCurrentField("customer_location_id");
                    updateField("customer_location_id");
                  }}
                  disabled={!formData.customer_id || locations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} {location.address && `- ${location.address}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FieldPresenceWrapper>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FieldPresenceWrapper fieldName="customer_contact_id" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="customer_contact_id">Contact</Label>
                <Select 
                  value={formData.customer_contact_id} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, customer_contact_id: value });
                    setCurrentField("customer_contact_id");
                    updateField("customer_contact_id");
                  }}
                  disabled={!formData.customer_id || contacts.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name}
                        {contact.email && ` (${contact.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FieldPresenceWrapper>

            <FieldPresenceWrapper fieldName="project_id" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="project_id">Project (Optional)</Label>
                <Select 
                  value={formData.project_id} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, project_id: value });
                    setCurrentField("project_id");
                    updateField("project_id");
                  }}
                  disabled={!formData.customer_id || projects.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
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
            </FieldPresenceWrapper>
          </div>

          <FieldPresenceWrapper fieldName="title" onlineUsers={onlineUsers}>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                onFocus={() => {
                  setCurrentField("title");
                  updateField("title");
                }}
                required
              />
            </div>
          </FieldPresenceWrapper>

          <FieldPresenceWrapper fieldName="description" onlineUsers={onlineUsers}>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                onFocus={() => {
                  setCurrentField("description");
                  updateField("description");
                }}
                rows={3}
              />
            </div>
          </FieldPresenceWrapper>

          <div className="grid grid-cols-2 gap-4">
            <FieldPresenceWrapper fieldName="work_order_number" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="work_order_number">Work Order Number</Label>
                <Input
                  id="work_order_number"
                  value={formData.work_order_number}
                  onChange={(e) => setFormData({ ...formData, work_order_number: e.target.value })}
                  onFocus={() => {
                    setCurrentField("work_order_number");
                    updateField("work_order_number");
                  }}
                  placeholder="WO-12345"
                />
              </div>
            </FieldPresenceWrapper>

            <FieldPresenceWrapper fieldName="purchase_order_number" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="purchase_order_number">Purchase Order Number</Label>
                <Input
                  id="purchase_order_number"
                  value={formData.purchase_order_number}
                  onChange={(e) => setFormData({ ...formData, purchase_order_number: e.target.value })}
                  onFocus={() => {
                    setCurrentField("purchase_order_number");
                    updateField("purchase_order_number");
                  }}
                  placeholder="PO-12345"
                />
              </div>
            </FieldPresenceWrapper>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FieldPresenceWrapper fieldName="status" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, status: value });
                    setCurrentField("status");
                    updateField("status");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FieldPresenceWrapper>

            <FieldPresenceWrapper fieldName="priority" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, priority: value });
                    setCurrentField("priority");
                    updateField("priority");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FieldPresenceWrapper>

            <FieldPresenceWrapper fieldName="skill_required" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="skill_required">Skill Required</Label>
                <Input
                  id="skill_required"
                  value={formData.skill_required}
                  onChange={(e) => setFormData({ ...formData, skill_required: e.target.value })}
                  onFocus={() => {
                    setCurrentField("skill_required");
                    updateField("skill_required");
                  }}
                  placeholder="e.g., Electrician"
                />
              </div>
            </FieldPresenceWrapper>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FieldPresenceWrapper fieldName="preferred_date" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="preferred_date">Preferred Date</Label>
                <Input
                  id="preferred_date"
                  type="date"
                  value={formData.preferred_date}
                  onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                  onFocus={() => {
                    setCurrentField("preferred_date");
                    updateField("preferred_date");
                  }}
                />
              </div>
            </FieldPresenceWrapper>

            <FieldPresenceWrapper fieldName="preferred_date_start" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="preferred_date_start">Date Range Start</Label>
                <Input
                  id="preferred_date_start"
                  type="date"
                  value={formData.preferred_date_start}
                  onChange={(e) => setFormData({ ...formData, preferred_date_start: e.target.value })}
                  onFocus={() => {
                    setCurrentField("preferred_date_start");
                    updateField("preferred_date_start");
                  }}
                />
              </div>
            </FieldPresenceWrapper>

            <FieldPresenceWrapper fieldName="preferred_date_end" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="preferred_date_end">Date Range End</Label>
                <Input
                  id="preferred_date_end"
                  type="date"
                  value={formData.preferred_date_end}
                  onChange={(e) => setFormData({ ...formData, preferred_date_end: e.target.value })}
                  onFocus={() => {
                    setCurrentField("preferred_date_end");
                    updateField("preferred_date_end");
                  }}
                />
              </div>
            </FieldPresenceWrapper>
          </div>

          {/* Line Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {lineItems.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead className="w-[15%]">Quantity</TableHead>
                      <TableHead className="w-[15%]">Unit Price</TableHead>
                      <TableHead className="w-[15%]">Total</TableHead>
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
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(index, "unit_price", e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          ${item.line_total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Tax Rate (%):</span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                  className="w-20 h-8"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax Amount:</span>
                <span>${totals.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>Total:</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end border-t pt-4">
            {orderId && (
              <CreateTaskButton
                linkedModule="service_order"
                linkedRecordId={orderId}
                variant="outline"
                size="default"
              />
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {orderId ? "Update" : "Create"} Order
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
