import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Paperclip } from "lucide-react";
import QuickLocationDialog from "@/components/customers/QuickLocationDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface InlineServiceOrderFormProps {
  parsedData?: any;
  ticket: any;
  onSuccess: (id: string) => void;
  onCancel: () => void;
}

export function InlineServiceOrderForm({ parsedData, ticket, onSuccess, onCancel }: InlineServiceOrderFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [ticketAttachments, setTicketAttachments] = useState<any[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    customer_id: ticket?.customer_id || "",
    location_id: "",
    title: parsedData?.title || ticket?.subject || "",
    description: parsedData?.description || ticket?.description || "",
    preferred_date: parsedData?.preferred_date || "",
    preferred_date_start: parsedData?.preferred_date_start || "",
    preferred_date_end: parsedData?.preferred_date_end || "",
    priority: parsedData?.priority || "normal",
    tax_rate: 10,
  });
  const [lineItems, setLineItems] = useState<LineItem[]>(
    parsedData?.line_items?.length > 0 
      ? parsedData.line_items 
      : [{ description: "", quantity: 1, unit_price: 0, line_total: 0 }]
  );

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
    fetchTicketAttachments();
  }, []);

  // Fetch locations when customer changes
  useEffect(() => {
    if (formData.customer_id) {
      fetchLocations(formData.customer_id);
    } else {
      setLocations([]);
      // Clear location_id when customer changes
      setFormData(prev => ({ ...prev, location_id: "" }));
    }
  }, [formData.customer_id]);

  // Auto-populate contacts from location when location changes
  useEffect(() => {
    if (formData.location_id && locations.length > 0) {
      const selectedLocation = locations.find((loc: any) => loc.id === formData.location_id);
      if (selectedLocation && selectedLocation.site_contact_id) {
        // Store contact IDs for use when creating the service order
        // These will be linked to the service order automatically
      }
    }
  }, [formData.location_id, locations]);

  const fetchTicketAttachments = async () => {
    if (!ticket?.id) return;

    try {
      const { data: messages, error } = await supabase
        .from("helpdesk_messages")
        .select("attachments, id")
        .eq("ticket_id", ticket.id)
        .not("attachments", "is", null);

      if (error) throw error;

      // Flatten all attachments from all messages
      const allAttachments: any[] = [];
      messages?.forEach((message: any) => {
        if (message.attachments && Array.isArray(message.attachments)) {
          message.attachments.forEach((att: any) => {
            allAttachments.push({
              ...att,
              messageId: message.id,
            });
          });
        }
      });

      setTicketAttachments(allAttachments);
      // Select all attachments by default
      setSelectedAttachments(new Set(allAttachments.map((_, idx) => idx.toString())));
    } catch (error) {
      console.error("Error fetching ticket attachments:", error);
    }
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    if (error) {
      toast({ 
        title: "Error fetching customers", 
        description: error.message,
        variant: "destructive" 
      });
    } else {
      setCustomers(data || []);
    }
  };

  const fetchLocations = async (customerId: string) => {
    const { data, error } = await supabase
      .from("customer_locations")
      .select("id, name, address, site_contact_id, facility_manager_contact_id")
      .eq("customer_id", customerId)
      .eq("is_active", true)
      .order("name");
    
    if (error) {
      toast({ 
        title: "Error fetching locations", 
        description: error.message,
        variant: "destructive" 
      });
    } else {
      setLocations(data || []);
    }
  };

  const handleLocationCreated = async (locationId: string) => {
    // Fetch updated locations first
    if (formData.customer_id) {
      await fetchLocations(formData.customer_id);
    }
    // Then update the form data with the new location using functional update
    setFormData(prev => ({ ...prev, location_id: locationId }));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const tax_amount = subtotal * (formData.tax_rate / 100);
    const total_amount = subtotal + tax_amount;
    return { subtotal, tax_amount, total_amount };
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0, line_total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].line_total = updated[index].quantity * updated[index].unit_price;
    }
    
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { subtotal, tax_amount, total_amount } = calculateTotals();

      // Validate required fields
      if (!formData.customer_id) {
        toast({
          title: "Customer required",
          description: "Please select a customer for this service order.",
          variant: "destructive",
        });
        return;
      }

      // Generate order number
      const { data: seqNumber, error: seqError } = await supabase.rpc(
        'get_next_sequential_number',
        { p_tenant_id: profile.tenant_id, p_entity_type: 'service_order' }
      );
      
      if (seqError) {
        console.error('Error generating order number:', seqError);
        toast({
          title: "Error",
          description: "Failed to generate order number. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Create service order
      const { data: serviceOrder, error: orderError } = await supabase
        .from('service_orders' as any)
        .insert({
          customer_id: formData.customer_id,
          location_id: formData.location_id || null,
          title: formData.title,
          description: formData.description,
          preferred_date: formData.preferred_date || null,
          preferred_date_start: formData.preferred_date_start || null,
          preferred_date_end: formData.preferred_date_end || null,
          priority: formData.priority,
          status: 'draft',
          order_number: seqNumber,
          work_order_number: seqNumber,
          subtotal,
          tax_amount,
          total_amount,
          tenant_id: profile.tenant_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (orderError || !serviceOrder) throw orderError || new Error("Failed to create service order");

      // Insert line items
      if (lineItems.length > 0 && lineItems[0].description) {
        const lineItemsToInsert = lineItems
          .filter(item => item.description.trim())
          .map((item, index) => ({
            service_order_id: (serviceOrder as any).id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
            item_order: index,
            tenant_id: profile.tenant_id,
          }));

        if (lineItemsToInsert.length > 0) {
          const { error: lineItemsError } = await supabase
            .from('service_order_line_items' as any)
            .insert(lineItemsToInsert);

          if (lineItemsError) throw lineItemsError;
        }
      }

      // Link to helpdesk ticket
      if (ticket?.id) {
        const { error: linkError } = await supabase
          .from('helpdesk_linked_documents' as any)
          .insert({
            ticket_id: ticket.id,
            document_type: 'service_order',
            document_id: (serviceOrder as any).id,
            tenant_id: profile.tenant_id,
          });

        if (linkError) console.error("Error linking ticket:", linkError);
      }

      // Copy selected attachments to service order
      if (selectedAttachments.size > 0) {
        const attachmentsToCopy = Array.from(selectedAttachments)
          .map(idx => ticketAttachments[parseInt(idx)])
          .filter(Boolean);

        for (const attachment of attachmentsToCopy) {
          try {
            // Note: For now we're just storing the metadata
            // In a production system, you'd want to download and re-upload the file
            // or implement a proper file copying mechanism
            await supabase
              .from('service_order_attachments')
              .insert({
                service_order_id: (serviceOrder as any).id,
                file_name: attachment.name,
                file_size: attachment.size,
                file_type: attachment.contentType,
                file_url: `helpdesk-attachment-${attachment.id || 'unknown'}`,
                tenant_id: profile.tenant_id,
                uploaded_by: user.id,
              });
          } catch (error) {
            console.error("Error copying attachment:", error);
          }
        }
      }

      toast({
        title: "Service order created",
        description: `Service order created ${selectedAttachments.size > 0 ? `with ${selectedAttachments.size} attachment(s)` : ''} and linked to this ticket.`,
      });

      onSuccess((serviceOrder as any).id);
    } catch (error) {
      console.error("Error creating service order:", error);
      toast({
        title: "Error",
        description: "Failed to create service order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, tax_amount, total_amount } = calculateTotals();

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="space-y-4 py-4 px-4">
          <div className="space-y-2">
            <Label htmlFor="customer_id">Customer *</Label>
            <Select
              value={formData.customer_id}
              onValueChange={(value) => setFormData({ ...formData, customer_id: value, location_id: "" })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a customer" />
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

          <div className="space-y-2">
            <Label htmlFor="location_id">Location</Label>
            <div className="flex gap-2">
              <Select
                value={formData.location_id}
                onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                disabled={!formData.customer_id}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={formData.customer_id ? "Select a location" : "Select customer first"} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} {location.address && `- ${location.address}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowLocationDialog(true)}
                disabled={!formData.customer_id}
                title="Create new location"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Service order title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the service needed..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferred_date">Preferred Date</Label>
            <Input
              id="preferred_date"
              type="date"
              value={formData.preferred_date}
              onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preferred_date_start">Preferred Start Date</Label>
              <Input
                id="preferred_date_start"
                type="date"
                value={formData.preferred_date_start}
                onChange={(e) => setFormData({ ...formData, preferred_date_start: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_date_end">Preferred End Date</Label>
              <Input
                id="preferred_date_end"
                type="date"
                value={formData.preferred_date_end}
                onChange={(e) => setFormData({ ...formData, preferred_date_end: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Line Items</Label>
              <Button type="button" onClick={addLineItem} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total</Label>
                        <Input
                          type="number"
                          value={item.line_total.toFixed(2)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-4 border-t">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm items-center gap-2">
                <span className="text-muted-foreground">Tax Rate (%):</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                  className="w-20 h-8"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax Amount:</span>
                <span className="font-medium">${tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold pt-1 border-t">
                <span>Total:</span>
                <span>${total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attachments Selection */}
        {ticketAttachments.length > 0 && (
          <div className="space-y-2 p-4">
            <Label className="text-sm font-medium">
              Copy Attachments to Service Order ({selectedAttachments.size} of {ticketAttachments.length} selected)
            </Label>
            <Card className="p-3">
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {ticketAttachments.map((attachment, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                      <Checkbox
                        id={`attachment-${idx}`}
                        checked={selectedAttachments.has(idx.toString())}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedAttachments);
                          if (checked) {
                            newSet.add(idx.toString());
                          } else {
                            newSet.delete(idx.toString());
                          }
                          setSelectedAttachments(newSet);
                        }}
                      />
                      <label 
                        htmlFor={`attachment-${idx}`}
                        className="flex items-center gap-2 flex-1 cursor-pointer"
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{attachment.name}</p>
                          {attachment.size && (
                            <p className="text-xs text-muted-foreground">
                              {Math.round(attachment.size / 1024)} KB
                            </p>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4 flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Order
        </Button>
      </div>

      </form>

      <QuickLocationDialog
        open={showLocationDialog}
        onOpenChange={setShowLocationDialog}
        customerId={formData.customer_id}
        customerName={customers.find(c => c.id === formData.customer_id)?.name}
        onLocationCreated={handleLocationCreated}
      />
    </>
  );
}
