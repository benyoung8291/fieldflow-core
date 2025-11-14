import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Upload, FileText, Calendar, MapPin, User } from "lucide-react";
import FieldPresenceWrapper from "@/components/presence/FieldPresenceWrapper";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import { usePresence } from "@/hooks/usePresence";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import ServiceOrderTemplatesDialog from "./ServiceOrderTemplatesDialog";
import QuickLocationDialog from "@/components/customers/QuickLocationDialog";
import QuickContactDialog from "@/components/customers/QuickContactDialog";
import PriceBookDialog from "@/components/quotes/PriceBookDialog";
import { Badge } from "@/components/ui/badge";
import SkillsMultiSelect from "@/components/skills/SkillsMultiSelect";
import { formatCurrency } from "@/lib/utils";

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  estimated_hours: number;
  item_order: number;
  notes?: string;
  price_book_item_id?: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
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
  const [uploading, setUploading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [currentField, setCurrentField] = useState<string>("");
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [priceBookDialogOpen, setPriceBookDialogOpen] = useState(false);
  const [quickLocationOpen, setQuickLocationOpen] = useState(false);
  const [quickContactOpen, setQuickContactOpen] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(10);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  
  const { onlineUsers, updateField, updateCursorPosition } = usePresence({
    page: "service-order-dialog",
    field: currentField,
  });

  // Fetch tax rate and project integration settings
  const { data: settings } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings" as any)
        .select("default_tax_rate, projects_service_orders_integration")
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as any;
    },
    enabled: open,
  });

  useEffect(() => {
    if (settings?.default_tax_rate) {
      setTaxRate(settings.default_tax_rate);
    }
  }, [settings]);

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
    allow_bidding: false,
    ready_for_billing: false,
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
      .from("contacts")
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
    try {
      // Fetch service order
      const { data: orderData, error: orderError } = await supabase
        .from("service_orders")
        .select("*")
        .eq("id", orderId)
        .single();
      
      if (orderError) throw orderError;

      // Fetch line items
      const { data: lineItemsData } = await supabase
        .from("service_order_line_items")
        .select("*")
        .eq("service_order_id", orderId)
        .order("item_order");

      // Fetch attachments
      const { data: attachmentsData } = await supabase
        .from("service_order_attachments" as any)
        .select("*")
        .eq("service_order_id", orderId)
        .order("created_at", { ascending: false });

      // Fetch appointments
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select("id, title, start_time, status")
        .eq("service_order_id", orderId)
        .order("start_time");

      // Fetch required skills
      const { data: skillsData } = await supabase
        .from("service_order_skills")
        .select("skill_id")
        .eq("service_order_id", orderId);

      if (skillsData) {
        setSelectedSkills(skillsData.map((s: any) => s.skill_id));
      }
      
      if (orderData) {
        setFormData({
          customer_id: orderData.customer_id || "",
          customer_location_id: orderData.customer_location_id || "",
          customer_contact_id: orderData.customer_contact_id || "",
          project_id: orderData.project_id || "",
          title: orderData.title || "",
          description: orderData.description || "",
          work_order_number: orderData.work_order_number || "",
          purchase_order_number: orderData.purchase_order_number || "",
          status: orderData.status || "draft",
          priority: orderData.priority || "normal",
          skill_required: orderData.skill_required || "",
          preferred_date: orderData.preferred_date || "",
          preferred_date_start: orderData.preferred_date_start || "",
          preferred_date_end: orderData.preferred_date_end || "",
          allow_bidding: orderData.allow_bidding || false,
          ready_for_billing: orderData.ready_for_billing || false,
        });

        if (lineItemsData) {
          setLineItems(
            lineItemsData.map((item: any) => ({
              id: item.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
              estimated_hours: item.estimated_hours || 0,
              item_order: item.item_order,
              notes: item.notes,
              price_book_item_id: item.price_book_item_id,
            }))
          );
        }

        if (attachmentsData) {
          setAttachments(attachmentsData as unknown as Attachment[]);
        }

        if (appointmentsData) {
          setAppointments(appointmentsData);
        }
      }
    } catch (error: any) {
      toast({ title: "Error fetching order", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
      allow_bidding: false,
      ready_for_billing: false,
    });
    setLineItems([]);
    setAttachments([]);
    setAppointments([]);
    setSelectedSkills([]);
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
        estimated_hours: 0,
        item_order: lineItems.length,
      },
    ]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    
    // Convert numeric fields to numbers
    if (field === "quantity" || field === "unit_price" || field === "estimated_hours") {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    // Recalculate line total
    if (field === "quantity" || field === "unit_price") {
      const qty = updated[index].quantity;
      const price = updated[index].unit_price;
      updated[index].line_total = qty * price;
    }
    
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handlePriceBookSelect = (item: any) => {
    const newItem = {
      description: item.description,
      quantity: 1,
      unit_price: item.sell_price,
      line_total: item.sell_price,
      estimated_hours: 0,
      item_order: lineItems.length,
      price_book_item_id: item.id,
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleTemplateSelect = async (templateId: string) => {
    try {
      const { data, error } = await supabase
        .from("service_order_template_line_items" as any)
        .select("*")
        .eq("template_id", templateId)
        .order("item_order");

      if (error) throw error;

      const { data: template } = await supabase
        .from("service_order_templates" as any)
        .select("name, description, skill_required")
        .eq("id", templateId)
        .single();

      if (template) {
        const t = template as unknown as { name: string; description: string; skill_required: string };
        setFormData({
          ...formData,
          title: t.name,
          description: t.description || "",
          skill_required: t.skill_required || "",
        });
      }

      if (data) {
        const newItems = data.map((item: any, index: number) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price,
          estimated_hours: item.estimated_hours || 0,
          item_order: lineItems.length + index,
          notes: item.notes,
          price_book_item_id: item.price_book_item_id,
        }));
        setLineItems([...lineItems, ...newItems]);
      }

      toast({ title: "Template applied successfully" });
    } catch (error: any) {
      toast({ title: "Error applying template", description: error.message, variant: "destructive" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !orderId) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${orderId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('service-order-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('service-order-attachments')
          .getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from("service_order_attachments" as any)
          .insert({
            service_order_id: orderId,
            tenant_id: profile?.tenant_id,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          });

        if (dbError) throw dbError;
      }

      toast({ title: "Files uploaded successfully" });
      fetchOrder();
    } catch (error: any) {
      toast({ title: "Error uploading files", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/');
      const filePath = urlParts.slice(-2).join('/');

      await supabase.storage
        .from('service-order-attachments')
        .remove([filePath]);

      await supabase
        .from("service_order_attachments" as any)
        .delete()
        .eq("id", attachmentId);

      toast({ title: "Attachment deleted" });
      fetchOrder();
    } catch (error: any) {
      toast({ title: "Error deleting attachment", description: error.message, variant: "destructive" });
    }
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    const totalHours = lineItems.reduce((sum, item) => sum + (Number(item.estimated_hours) || 0), 0);
    return { subtotal, taxAmount, total, totalHours };
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
        tenant_id: profile?.tenant_id,
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
        tax_rate: taxRate,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        estimated_hours: totals.totalHours,
        allow_bidding: formData.allow_bidding,
        ready_for_billing: formData.status === "completed" ? formData.ready_for_billing : false,
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
          estimated_hours: item.estimated_hours || 0,
          item_order: index,
          notes: item.notes || null,
          price_book_item_id: item.price_book_item_id || null,
        }));

        const { error: lineError } = await supabase
          .from("service_order_line_items")
          .insert(lineItemsData);

        if (lineError) throw lineError;
      }

      // Handle skills
      if (orderId) {
        // Delete existing skills
        await supabase
          .from("service_order_skills")
          .delete()
          .eq("service_order_id", orderId);
      }

      // Insert new skills
      if (selectedSkills.length > 0) {
        const skillsData = selectedSkills.map((skillId) => ({
          service_order_id: savedOrderId,
          skill_id: skillId,
        }));

        const { error: skillsError } = await supabase
          .from("service_order_skills")
          .insert(skillsData);

        if (skillsError) throw skillsError;
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
    <>
      <ServiceOrderTemplatesDialog
        open={templatesDialogOpen}
        onOpenChange={setTemplatesDialogOpen}
        onSelectTemplate={handleTemplateSelect}
      />

      <PriceBookDialog
        open={priceBookDialogOpen}
        onOpenChange={setPriceBookDialogOpen}
        onSelectItem={handlePriceBookSelect}
      />

      {formData.customer_id && (
        <>
          <QuickLocationDialog
            open={quickLocationOpen}
            onOpenChange={setQuickLocationOpen}
            customerId={formData.customer_id}
            onLocationCreated={(locationId) => {
              setFormData({ ...formData, customer_location_id: locationId });
              fetchCustomerRelatedData(formData.customer_id);
            }}
          />

          <QuickContactDialog
            open={quickContactOpen}
            onOpenChange={setQuickContactOpen}
            customerId={formData.customer_id}
            onContactCreated={(contactId) => {
              setFormData({ ...formData, customer_contact_id: contactId });
              fetchCustomerRelatedData(formData.customer_id);
            }}
          />
        </>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>{orderId ? "Edit" : "Create"} Service Order</DialogTitle>
              <PresenceIndicator users={onlineUsers} />
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="line-items">Line Items</TabsTrigger>
              {orderId && <TabsTrigger value="attachments">Attachments</TabsTrigger>}
              {orderId && <TabsTrigger value="appointments">Appointments</TabsTrigger>}
            </TabsList>

            <form onSubmit={handleSubmit}>
              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTemplatesDialogOpen(true)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                </div>

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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="customer_location_id">Location</Label>
                        {formData.customer_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setQuickLocationOpen(true)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
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

                <div className={`grid gap-4 ${settings?.projects_service_orders_integration ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <FieldPresenceWrapper fieldName="customer_contact_id" onlineUsers={onlineUsers}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="customer_contact_id">Contact</Label>
                        {formData.customer_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setQuickContactOpen(true)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
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

                  {settings?.projects_service_orders_integration && (
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
                  )}
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
                          <SelectItem value="draft">Waiting</SelectItem>
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

                  <FieldPresenceWrapper fieldName="required_skills" onlineUsers={onlineUsers}>
                    <div className="space-y-2">
                      <Label htmlFor="required_skills">Required Skills</Label>
                      <SkillsMultiSelect
                        value={selectedSkills}
                        onChange={(skills) => {
                          setSelectedSkills(skills);
                          setCurrentField("required_skills");
                          updateField("required_skills");
                        }}
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

                <FieldPresenceWrapper fieldName="allow_bidding" onlineUsers={onlineUsers}>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allow_bidding"
                      checked={formData.allow_bidding}
                      onCheckedChange={(checked) => {
                        setFormData({ ...formData, allow_bidding: checked });
                        setCurrentField("allow_bidding");
                        updateField("allow_bidding");
                      }}
                    />
                    <Label htmlFor="allow_bidding">
                      Allow workers to bid on this service order
                    </Label>
                  </div>
                </FieldPresenceWrapper>

                {formData.status === "completed" && (
                  <FieldPresenceWrapper fieldName="ready_for_billing" onlineUsers={onlineUsers}>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="ready_for_billing"
                        checked={formData.ready_for_billing}
                        onCheckedChange={(checked) => {
                          setFormData({ ...formData, ready_for_billing: checked });
                          setCurrentField("ready_for_billing");
                          updateField("ready_for_billing");
                        }}
                      />
                      <Label htmlFor="ready_for_billing">
                        Ready for Billing (show in invoice creation)
                      </Label>
                    </div>
                  </FieldPresenceWrapper>
                )}
              </TabsContent>

              <TabsContent value="line-items" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPriceBookDialogOpen(true)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Add from Price Book
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>

                {lineItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[30%]">Description</TableHead>
                          <TableHead className="w-[12%]">Quantity</TableHead>
                          <TableHead className="w-[12%]">Unit Price</TableHead>
                          <TableHead className="w-[12%]">Est. Hours</TableHead>
                          <TableHead className="w-[12%]">Total</TableHead>
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
                              <Input
                                type="number"
                                step="0.25"
                                value={item.estimated_hours}
                                onChange={(e) => updateLineItem(index, "estimated_hours", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              {formatCurrency(item.line_total)}
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

                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax ({taxRate}%):</span>
                      <span>{formatCurrency(totals.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(totals.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Est. Total Hours:</span>
                      <span>{totals.totalHours.toFixed(2)} hrs</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {orderId && (
                <TabsContent value="attachments" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <Label>Attachments</Label>
                    <div>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload Files
                      </Button>
                    </div>
                  </div>

                  {attachments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No attachments yet. Upload files to get started.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{attachment.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(attachment.file_size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(attachment.file_url, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAttachment(attachment.id, attachment.file_url)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}

              {orderId && (
                <TabsContent value="appointments" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <Label>Linked Appointments</Label>
                    <Badge variant="outline">{appointments.length} Linked</Badge>
                  </div>

                  {appointments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No appointments linked yet. Create appointments from the Scheduler page.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {appointments.map((appointment: any) => (
                        <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{appointment.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(appointment.start_time).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Badge>{appointment.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}

              <div className="flex gap-2 justify-end border-t pt-4 mt-4">
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
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
