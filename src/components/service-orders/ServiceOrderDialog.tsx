import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import FieldPresenceWrapper from "@/components/presence/FieldPresenceWrapper";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import RemoteCursors from "@/components/presence/RemoteCursors";
import { usePresence } from "@/hooks/usePresence";

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
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [currentField, setCurrentField] = useState<string>("");
  
  const { onlineUsers, updateField, updateCursorPosition } = usePresence({
    page: "service-order-dialog",
    field: currentField,
  });

  // Track mouse movement for cursor sharing
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
    project_id: "",
    title: "",
    description: "",
    status: "draft",
    priority: "normal",
    billing_type: "hourly",
    fixed_amount: "",
    hourly_rate: "",
    assigned_to: "",
    scheduled_date: "",
  });

  useEffect(() => {
    if (open) {
      fetchCustomers();
      fetchTechnicians();
      if (orderId) {
        fetchOrder();
      } else {
        resetForm();
      }
    }
  }, [open, orderId]);

  useEffect(() => {
    if (formData.customer_id) {
      fetchProjects(formData.customer_id);
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

  const fetchTechnicians = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name");
    
    if (error) {
      toast({ title: "Error fetching technicians", variant: "destructive" });
    } else {
      setTechnicians(data || []);
    }
  };

  const fetchProjects = async (customerId: string) => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .eq("customer_id", customerId)
      .order("name");
    
    if (error) {
      toast({ title: "Error fetching projects", variant: "destructive" });
    } else {
      setProjects(data || []);
    }
  };

  const fetchOrder = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_orders")
      .select("*")
      .eq("id", orderId)
      .single();
    
    if (error) {
      toast({ title: "Error fetching order", variant: "destructive" });
    } else if (data) {
      setFormData({
        customer_id: data.customer_id || "",
        project_id: data.project_id || "",
        title: data.title || "",
        description: data.description || "",
        status: data.status || "draft",
        priority: data.priority || "normal",
        billing_type: data.billing_type || "hourly",
        fixed_amount: data.fixed_amount?.toString() || "",
        hourly_rate: data.hourly_rate?.toString() || "",
        assigned_to: data.assigned_to || "",
        scheduled_date: data.scheduled_date || "",
      });
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      customer_id: "",
      project_id: "",
      title: "",
      description: "",
      status: "draft",
      priority: "normal",
      billing_type: "hourly",
      fixed_amount: "",
      hourly_rate: "",
      assigned_to: "",
      scheduled_date: "",
    });
    setProjects([]);
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

      const orderData: any = {
        customer_id: formData.customer_id,
        project_id: formData.project_id || null,
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        billing_type: formData.billing_type,
        fixed_amount: formData.fixed_amount ? parseFloat(formData.fixed_amount) : null,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        assigned_to: formData.assigned_to || null,
        scheduled_date: formData.scheduled_date || null,
      };

      if (!orderId) {
        orderData.created_by = user.id;
        orderData.order_number = `SO-${Date.now()}`;
      }

      if (orderId) {
        const { error } = await supabase
          .from("service_orders")
          .update(orderData)
          .eq("id", orderId);

        if (error) throw error;
        toast({ title: "Service order updated successfully" });
      } else {
        const { error } = await supabase
          .from("service_orders")
          .insert([orderData]);

        if (error) throw error;
        toast({ title: "Service order created successfully" });
      }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    setFormData({ ...formData, customer_id: value, project_id: "" });
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FieldPresenceWrapper fieldName="assigned_to" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assigned To</Label>
                <Select 
                  value={formData.assigned_to} 
                  onValueChange={(value) => {
                    setFormData({ ...formData, assigned_to: value });
                    setCurrentField("assigned_to");
                    updateField("assigned_to");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.first_name} {tech.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FieldPresenceWrapper>

            <FieldPresenceWrapper fieldName="scheduled_date" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="scheduled_date">Scheduled Date</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  onFocus={() => {
                    setCurrentField("scheduled_date");
                    updateField("scheduled_date");
                  }}
                />
              </div>
            </FieldPresenceWrapper>
          </div>

          <FieldPresenceWrapper fieldName="billing_type" onlineUsers={onlineUsers}>
            <div className="space-y-2">
              <Label htmlFor="billing_type">Billing Type</Label>
              <Select 
                value={formData.billing_type} 
                onValueChange={(value) => {
                  setFormData({ ...formData, billing_type: value });
                  setCurrentField("billing_type");
                  updateField("billing_type");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly Rate</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldPresenceWrapper>

          {(formData.billing_type === "hourly" || formData.billing_type === "both") && (
            <FieldPresenceWrapper fieldName="hourly_rate" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  onFocus={() => {
                    setCurrentField("hourly_rate");
                    updateField("hourly_rate");
                  }}
                />
              </div>
            </FieldPresenceWrapper>
          )}

          {(formData.billing_type === "fixed" || formData.billing_type === "both") && (
            <FieldPresenceWrapper fieldName="fixed_amount" onlineUsers={onlineUsers}>
              <div className="space-y-2">
                <Label htmlFor="fixed_amount">Fixed Amount ($)</Label>
                <Input
                  id="fixed_amount"
                  type="number"
                  step="0.01"
                  value={formData.fixed_amount}
                  onChange={(e) => setFormData({ ...formData, fixed_amount: e.target.value })}
                  onFocus={() => {
                    setCurrentField("fixed_amount");
                    updateField("fixed_amount");
                  }}
                />
              </div>
            </FieldPresenceWrapper>
          )}

          <div className="flex gap-2 justify-end">
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