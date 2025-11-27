import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectWithSearch } from "@/components/ui/select-with-search";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { z } from "zod";
import CreateLeadDialog from "../leads/CreateLeadDialog";

const quoteSchema = z.object({
  customer_id: z.string().optional(),
  lead_id: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  valid_until: z.string().optional(),
  tax_rate: z.string().optional(),
}).refine((data) => data.customer_id || data.lead_id, {
  message: "Either customer or lead must be selected",
  path: ["customer_id"],
});

interface QuoteHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
}

export default function QuoteHeaderDialog({ open, onOpenChange, leadId }: QuoteHeaderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [isForLead, setIsForLead] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createLeadOpen, setCreateLeadOpen] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: "",
    lead_id: "",
    title: "",
    description: "",
    valid_until: "",
    tax_rate: "10",
    pipeline_id: "",
    stage_id: "",
  });

  // Fetch pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ["crm-pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines" as any)
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: open,
  });

  // Fetch stages for selected pipeline
  const { data: stages = [] } = useQuery({
    queryKey: ["crm-stages", formData.pipeline_id],
    queryFn: async () => {
      if (!formData.pipeline_id) return [];

      const { data, error } = await supabase
        .from("crm_status_settings")
        .select("*")
        .eq("pipeline_id", formData.pipeline_id)
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!formData.pipeline_id,
  });

  useEffect(() => {
    if (open) {
      fetchCustomersAndLeads();
      fetchDefaultSettings();
      
      if (leadId) {
        // Initialize for lead
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        setIsForLead(true);
        setFormData(prev => ({
          ...prev,
          lead_id: leadId,
          customer_id: "",
          valid_until: defaultDate.toISOString().split('T')[0],
        }));
      } else {
        // Reset form for new quote
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        setFormData({
          customer_id: "",
          lead_id: "",
          title: "",
          description: "",
          valid_until: defaultDate.toISOString().split('T')[0],
          tax_rate: "10",
          pipeline_id: "",
          stage_id: "",
        });
        setIsForLead(false);
      }
    }
  }, [open, leadId]);

  const fetchDefaultSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_pipeline_id, default_stage_id")
        .eq("id", user.id)
        .single();
        
      if (profile) {
        setFormData(prev => ({
          ...prev,
          pipeline_id: profile.default_pipeline_id || '',
          stage_id: profile.default_stage_id || '',
        }));
      }
    }
  };

  const fetchCustomersAndLeads = async () => {
    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (customersError) {
      toast({ title: "Error fetching customers", variant: "destructive" });
    } else {
      setCustomers(customersData || []);
    }

    const { data: leadsData, error: leadsError } = await supabase
      .from("leads")
      .select("id, name, company_name")
      .eq("is_active", true)
      .is("converted_to_customer_id", null)
      .order("name");

    if (leadsError) {
      toast({ title: "Error fetching leads", variant: "destructive" });
    } else {
      setLeads(leadsData || []);
    }
  };

  const validateForm = () => {
    try {
      quoteSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          newErrors[path] = err.message;
        });
        setErrors(newErrors);
        toast({ title: "Please fix validation errors", variant: "destructive" });
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Not authenticated", variant: "destructive" });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile?.tenant_id) {
        toast({ 
          title: "Error fetching profile", 
          variant: "destructive" 
        });
        return;
      }

      // Get sequential number
      const { data: sequentialSetting } = await supabase
        .from("sequential_number_settings")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("entity_type", "quote")
        .maybeSingle();

      let nextNumber = 1;
      let prefix = "QT";
      let numberLength = 5;

      if (sequentialSetting) {
        nextNumber = sequentialSetting.next_number || 1;
        prefix = sequentialSetting.prefix || "QT";
        numberLength = sequentialSetting.number_length || 5;
      }

      const separator = prefix.endsWith('-') ? '' : '-';
      const quoteNumber = `${prefix}${separator}${String(nextNumber).padStart(numberLength, "0")}`;

      const quoteData: any = {
        tenant_id: profile.tenant_id,
        customer_id: isForLead ? null : formData.customer_id || null,
        lead_id: isForLead ? formData.lead_id || null : null,
        is_for_lead: isForLead,
        title: formData.title,
        description: formData.description || null,
        valid_until: formData.valid_until || null,
        quote_number: quoteNumber,
        subtotal: 0,
        tax_rate: parseFloat(formData.tax_rate) || 10,
        tax_amount: 0,
        total_amount: 0,
        notes: null,
        terms_conditions: null,
        internal_notes: null,
        pipeline_id: formData.pipeline_id || null,
        stage_id: formData.stage_id || null,
        created_by: user.id,
        status: "draft",
      };

      const { data: newQuote, error } = await supabase
        .from("quotes")
        .insert([quoteData])
        .select()
        .single();

      if (error) throw error;

      // Update sequential number
      if (sequentialSetting) {
        await supabase
          .from("sequential_number_settings")
          .update({ next_number: nextNumber + 1 })
          .eq("id", sequentialSetting.id);
      } else {
        await supabase
          .from("sequential_number_settings")
          .insert({
            tenant_id: profile.tenant_id,
            entity_type: "quote",
            prefix: "QT",
            next_number: 2,
            number_length: 5,
          });
      }

      toast({ title: "Quote created successfully" });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      
      if (isForLead && formData.lead_id) {
        queryClient.invalidateQueries({ queryKey: ["lead-quotes", formData.lead_id] });
      }
      if (!isForLead && formData.customer_id) {
        queryClient.invalidateQueries({ queryKey: ["customer-quotes", formData.customer_id] });
      }
      
      onOpenChange(false);
      
      // Navigate to quote details to add line items
      navigate(`/quotes/${newQuote.id}`);
    } catch (error: any) {
      toast({
        title: "Error creating quote",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const customerOptions = customers.map(c => ({
    value: c.id,
    label: c.name,
  }));

  const leadOptions = leads.map(l => ({
    value: l.id,
    label: l.company_name || l.name,
  }));

  return (
    <>
      <CreateLeadDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        onLeadCreated={(newLeadId) => {
          setFormData({ ...formData, lead_id: newLeadId, customer_id: "" });
          setIsForLead(true);
          fetchCustomersAndLeads();
        }}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Quote</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={!isForLead ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsForLead(false);
                    setFormData({ ...formData, lead_id: "", customer_id: "" });
                  }}
                >
                  Customer
                </Button>
                <Button
                  type="button"
                  variant={isForLead ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsForLead(true);
                    setFormData({ ...formData, customer_id: "", lead_id: "" });
                  }}
                >
                  Lead
                </Button>
              </div>
            </div>

            {!isForLead ? (
              <div className="space-y-2">
                <Label>Customer *</Label>
                <SelectWithSearch
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                  options={customerOptions}
                  placeholder="Select customer"
                  searchPlaceholder="Search customers..."
                  emptyText="No customers found"
                  className={errors.customer_id ? "border-red-500" : ""}
                />
                {errors.customer_id && <p className="text-sm text-red-500">{errors.customer_id}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Lead *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreateLeadOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    New Lead
                  </Button>
                </div>
                <SelectWithSearch
                  value={formData.lead_id}
                  onValueChange={(value) => setFormData({ ...formData, lead_id: value })}
                  options={leadOptions}
                  placeholder="Select lead"
                  searchPlaceholder="Search leads..."
                  emptyText="No leads found"
                  className={errors.lead_id ? "border-red-500" : ""}
                />
                {errors.lead_id && <p className="text-sm text-red-500">{errors.lead_id}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pipeline</Label>
                <Select
                  value={formData.pipeline_id}
                  onValueChange={(value) => setFormData({ ...formData, pipeline_id: value, stage_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline: any) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Stage</Label>
                <Select
                  value={formData.stage_id}
                  onValueChange={(value) => setFormData({ ...formData, stage_id: value })}
                  disabled={!formData.pipeline_id || stages.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage: any) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={errors.title ? "border-red-500" : ""}
              />
              {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <RichTextEditor
                value={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Enter a description..."
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_until">Valid Until</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  step="0.01"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Quote
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
