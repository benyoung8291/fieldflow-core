import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectWithSearch } from "@/components/ui/select-with-search";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, BookOpen, Upload, X, FileText, Sparkles, UserPlus, Save } from "lucide-react";
import { z } from "zod";
import PriceBookDialog from "./PriceBookDialog";
import AILineItemMatcher from "./AILineItemMatcher";
import CreateLeadDialog from "../leads/CreateLeadDialog";
import QuoteItemTemplatesDialog from "./QuoteItemTemplatesDialog";
import SaveAsTemplateDialog from "./SaveAsTemplateDialog";
import QuoteDescriptionTemplateDialog from "./QuoteDescriptionTemplateDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";

const quoteSchema = z.object({
  customer_id: z.string().optional(),
  lead_id: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  valid_until: z.string().optional(),
  tax_rate: z.string().optional(),
  notes: z.string().max(2000, "Notes must be less than 2000 characters").optional(),
  terms_conditions: z.string().max(2000, "Terms must be less than 2000 characters").optional(),
}).refine((data) => data.customer_id || data.lead_id, {
  message: "Either customer or lead must be selected",
  path: ["customer_id"],
});

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId?: string;
  leadId?: string;
}

interface LineItem {
  id?: string;
  description: string;
  quantity: string;
  cost_price: string;
  margin_percentage: string;
  sell_price: string;
  line_total: number;
  parent_line_item_id?: string;
  subItems?: LineItem[];
  expanded?: boolean;
}

export default function QuoteDialog({ open, onOpenChange, quoteId, leadId }: QuoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [isForLead, setIsForLead] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [priceBookOpen, setPriceBookOpen] = useState(false);
  const [selectedParentIndex, setSelectedParentIndex] = useState<number | null>(null);
  const [isComplexQuote, setIsComplexQuote] = useState(false);
  const [aiMatcherOpen, setAiMatcherOpen] = useState(false);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [updatedFields, setUpdatedFields] = useState<Record<string, boolean>>({});
  const [descriptionTemplateDialogOpen, setDescriptionTemplateDialogOpen] = useState(false);

  const clearUpdatedField = (key: string) => {
    setTimeout(() => {
      setUpdatedFields(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }, 600);
  };

  const [formData, setFormData] = useState({
    customer_id: "",
    lead_id: "",
    title: "",
    description: "",
    valid_until: "",
    tax_rate: "10",
    notes: "",
    terms_conditions: "",
    internal_notes: "",
    pipeline_id: "",
    stage_id: "",
  });

  // Debug logging for state changes
  useEffect(() => {
    console.log('[QuoteDialog] State update - isForLead:', isForLead, 'leads:', leads.length, 'customers:', customers.length, 'formData.lead_id:', formData.lead_id, 'formData.customer_id:', formData.customer_id);
  }, [isForLead, leads, customers, formData.lead_id, formData.customer_id]);

  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Fetch templates
  const { data: messageTemplates = [] } = useQuery({
    queryKey: ["customer-message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_message_templates")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: termsTemplates = [] } = useQuery({
    queryKey: ["terms-conditions-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms_conditions_templates")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
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

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { 
      description: "", 
      quantity: "1", 
      cost_price: "0",
      margin_percentage: "30",
      sell_price: "0",
      line_total: 0,
      subItems: [],
      expanded: false
    },
  ]);

  // Fetch default margin percentage
  const { data: defaultMarginData } = useQuery({
    queryKey: ["general-settings-default-margin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings" as any)
        .select("default_margin_percentage")
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return (data as any)?.default_margin_percentage || 30;
    },
  });

  // Fetch data when dialog opens
  useEffect(() => {
    console.log('[QuoteDialog] Dialog opened - open:', open, 'quoteId:', quoteId, 'leadId:', leadId);
    if (open) {
      fetchTenantId();
      fetchCustomersAndLeads();
      
      if (quoteId) {
        fetchQuote();
      }
    }
  }, [open, quoteId]);

  // Initialize form for lead after leads are loaded
  useEffect(() => {
    if (open && leadId && !quoteId && leads.length > 0) {
      console.log('[QuoteDialog] Initializing form for lead:', leadId, 'Leads loaded:', leads.length);
      const leadExists = leads.some(l => l.id === leadId);
      console.log('[QuoteDialog] Lead found in list:', leadExists, leads.map(l => ({ id: l.id, name: l.name })));
      
      if (leadExists) {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        
        setIsForLead(true);
        setFormData({
          customer_id: "",
          lead_id: leadId,
          title: "",
          description: "",
          valid_until: defaultDate.toISOString().split('T')[0],
          tax_rate: "10",
          notes: "",
          terms_conditions: "",
          internal_notes: "",
          pipeline_id: "",
          stage_id: "",
        });
        console.log('[QuoteDialog] Form initialized with lead_id:', leadId);
      } else {
        console.error('[QuoteDialog] Lead not found in leads array!');
      }
    } else if (open && !leadId && !quoteId && leads.length > 0) {
      // New quote without lead
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      
      resetForm();
      setFormData(prev => ({
        ...prev,
        valid_until: defaultDate.toISOString().split('T')[0],
      }));
    }
  }, [open, leadId, quoteId, leads]);

  const fetchTenantId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, default_pipeline_id, default_stage_id")
        .eq("id", user.id)
        .single();
        
      if (profile) {
        setTenantId(profile.tenant_id);
        
        // Set default pipeline and stage for new quotes
        if (!quoteId && profile.default_pipeline_id) {
          setFormData(prev => ({
            ...prev,
            pipeline_id: profile.default_pipeline_id || '',
            stage_id: profile.default_stage_id || '',
          }));
        }
      }
    }
  };

  const fetchCustomersAndLeads = async () => {
    console.log('[QuoteDialog] Fetching customers and leads...');
    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (customersError) {
      console.error('[QuoteDialog] Error fetching customers:', customersError);
      toast({ title: "Error fetching customers", variant: "destructive" });
    } else {
      console.log('[QuoteDialog] Customers fetched:', customersData?.length);
      setCustomers(customersData || []);
    }

    const { data: leadsData, error: leadsError } = await supabase
      .from("leads")
      .select("id, name, company_name")
      .eq("is_active", true)
      .is("converted_to_customer_id", null)
      .order("name");

    if (leadsError) {
      console.error('[QuoteDialog] Error fetching leads:', leadsError);
      toast({ title: "Error fetching leads", variant: "destructive" });
      setLeads([]);
      return [];
    } else {
      console.log('[QuoteDialog] Leads fetched:', leadsData?.length, leadsData);
      setLeads(leadsData || []);
      return leadsData || [];
    }
  };

  const fetchQuote = async () => {
    setLoading(true);
    const { data: quoteData, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quoteError) {
      toast({ title: "Error fetching quote", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("quote_line_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("item_order");

    if (itemsError) {
      toast({ title: "Error fetching quote items", variant: "destructive" });
    }

    if (quoteData) {
      setIsComplexQuote(quoteData.quote_type === 'complex');
      setIsForLead(quoteData.is_for_lead || false);
      setFormData({
        customer_id: quoteData.customer_id || "",
        lead_id: quoteData.lead_id || "",
        title: quoteData.title || "",
        description: quoteData.description || "",
        valid_until: quoteData.valid_until || "",
        tax_rate: quoteData.tax_rate?.toString() || "10",
        notes: quoteData.notes || "",
        terms_conditions: quoteData.terms_conditions || "",
        internal_notes: quoteData.internal_notes || "",
        pipeline_id: quoteData.pipeline_id || "",
        stage_id: quoteData.stage_id || "",
      });

      // Fetch attachments
      const { data: attachmentsData } = await supabase
        .from("quote_attachments")
        .select("*")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false });
      
      if (attachmentsData) {
        setAttachments(attachmentsData);
      }

      if (itemsData && itemsData.length > 0) {
        // Build hierarchical structure
        const parentItems = itemsData.filter(item => !item.parent_line_item_id);
        const hierarchicalItems = parentItems.map((parent: any) => {
          const subItems = itemsData
            .filter((item: any) => item.parent_line_item_id === parent.id)
            .map((sub: any) => ({
              id: sub.id,
              description: sub.description,
              quantity: sub.quantity.toString(),
              cost_price: sub.cost_price?.toString() || "0",
              margin_percentage: sub.margin_percentage?.toString() || "0",
              sell_price: sub.sell_price?.toString() || "0",
              line_total: sub.line_total,
            }));

          return {
            id: parent.id,
            description: parent.description,
            quantity: parent.quantity.toString(),
            cost_price: parent.cost_price?.toString() || "0",
            margin_percentage: parent.margin_percentage?.toString() || "0",
            sell_price: parent.sell_price?.toString() || "0",
            line_total: parent.line_total,
            subItems,
            expanded: subItems.length > 0,
          };
        });

        setLineItems(hierarchicalItems);
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    setIsForLead(false);
    setIsComplexQuote(false);
    setFormData({
      customer_id: "",
      lead_id: "",
      title: "",
      description: "",
      valid_until: "",
      tax_rate: "10",
      notes: "",
      terms_conditions: "",
      internal_notes: "",
      pipeline_id: "",
      stage_id: "",
    });
    const defaultMargin = defaultMarginData?.toString() || "30";
    setLineItems([{ 
      description: "", 
      quantity: "1", 
      cost_price: "",
      margin_percentage: defaultMargin,
      sell_price: "",
      line_total: 0,
      subItems: [],
      expanded: false
    }]);
    setErrors({});
    setIsComplexQuote(false);
    setIsForLead(false);
    setAttachments([]);
  };

  const calculatePricing = (cost: string, margin: string, sell: string, changedField: string) => {
    const costNum = parseFloat(cost) || 0;
    const marginNum = parseFloat(margin) || 0;
    const sellNum = parseFloat(sell) || 0;

    if (changedField === "cost_price" || changedField === "margin_percentage") {
      const newSellNum = costNum * (1 + marginNum / 100);
      return {
        cost_price: cost,
        margin_percentage: margin,
        sell_price: newSellNum.toFixed(2),
      };
    } else {
      const newMargin = costNum > 0 ? (((sellNum - costNum) / costNum) * 100).toFixed(2) : "0";
      return {
        cost_price: cost,
        margin_percentage: newMargin,
        sell_price: sell,
      };
    }
  };

  const calculateLineTotal = (item: LineItem): number => {
    const qty = parseFloat(item.quantity) || 0;
    
    if (item.subItems && item.subItems.length > 0) {
      // Calculate from sub-items
      const subTotal = item.subItems.reduce((sum, sub) => {
        const subQty = parseFloat(sub.quantity) || 0;
        const subSell = parseFloat(sub.sell_price) || 0;
        return sum + (subQty * subSell);
      }, 0);
      return qty * subTotal;
    } else {
      const sell = parseFloat(item.sell_price) || 0;
      return qty * sell;
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    const item = updated[index];
    
    if (field === "cost_price" || field === "margin_percentage" || field === "sell_price") {
      const pricing = calculatePricing(
        field === "cost_price" ? value : item.cost_price,
        field === "margin_percentage" ? value : item.margin_percentage,
        field === "sell_price" ? value : item.sell_price,
        field
      );
      updated[index] = { ...item, ...pricing };
      
      // Mark auto-updated fields
      if (field === "cost_price" || field === "margin_percentage") {
        const sellKey = `${index}-sell_price`;
        setUpdatedFields(prev => ({ ...prev, [sellKey]: true }));
        clearUpdatedField(sellKey);
      } else if (field === "sell_price") {
        const marginKey = `${index}-margin_percentage`;
        setUpdatedFields(prev => ({ ...prev, [marginKey]: true }));
        clearUpdatedField(marginKey);
      }
    } else {
      updated[index] = { ...item, [field]: value };
    }

    updated[index].line_total = calculateLineTotal(updated[index]);
    
    // Mark line total as updated
    const totalKey = `${index}-line_total`;
    setUpdatedFields(prev => ({ ...prev, [totalKey]: true }));
    clearUpdatedField(totalKey);
    
    setLineItems(updated);
  };

  const updateSubItem = (parentIndex: number, subIndex: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    const subItem = updated[parentIndex].subItems![subIndex];

    if (field === "cost_price" || field === "margin_percentage" || field === "sell_price") {
      const pricing = calculatePricing(
        field === "cost_price" ? value : subItem.cost_price,
        field === "margin_percentage" ? value : subItem.margin_percentage,
        field === "sell_price" ? value : subItem.sell_price,
        field
      );
      updated[parentIndex].subItems![subIndex] = { ...subItem, ...pricing };
      
      // Mark auto-updated fields
      if (field === "cost_price" || field === "margin_percentage") {
        const sellKey = `${parentIndex}-${subIndex}-sell_price`;
        setUpdatedFields(prev => ({ ...prev, [sellKey]: true }));
        clearUpdatedField(sellKey);
      } else if (field === "sell_price") {
        const marginKey = `${parentIndex}-${subIndex}-margin_percentage`;
        setUpdatedFields(prev => ({ ...prev, [marginKey]: true }));
        clearUpdatedField(marginKey);
      }
    } else {
      updated[parentIndex].subItems![subIndex] = { ...subItem, [field]: value };
    }

    // Recalculate sub-item line total
    const qty = parseFloat(updated[parentIndex].subItems![subIndex].quantity) || 0;
    const sell = parseFloat(updated[parentIndex].subItems![subIndex].sell_price) || 0;
    updated[parentIndex].subItems![subIndex].line_total = qty * sell;
    
    // Mark sub-item line total as updated
    const subTotalKey = `${parentIndex}-${subIndex}-line_total`;
    setUpdatedFields(prev => ({ ...prev, [subTotalKey]: true }));
    clearUpdatedField(subTotalKey);

    // Recalculate parent line total
    updated[parentIndex].line_total = calculateLineTotal(updated[parentIndex]);
    
    // Mark parent line total as updated
    const parentTotalKey = `${parentIndex}-line_total`;
    setUpdatedFields(prev => ({ ...prev, [parentTotalKey]: true }));
    clearUpdatedField(parentTotalKey);
    
    setLineItems(updated);
  };

  const addLineItem = () => {
    const defaultMargin = defaultMarginData?.toString() || "30";
    setLineItems([...lineItems, {
      description: "",
      quantity: "1",
      cost_price: "",
      margin_percentage: defaultMargin,
      sell_price: "",
      line_total: 0,
      subItems: [],
      expanded: false
    }]);
  };

  const addSubItem = (parentIndex: number) => {
    const defaultMargin = defaultMarginData?.toString() || "30";
    const updated = [...lineItems];
    if (!updated[parentIndex].subItems) {
      updated[parentIndex].subItems = [];
    }
    updated[parentIndex].subItems!.push({
      description: "",
      quantity: "1",
      cost_price: "",
      margin_percentage: defaultMargin,
      sell_price: "",
      line_total: 0,
    });
    updated[parentIndex].expanded = true;
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const removeSubItem = (parentIndex: number, subIndex: number) => {
    const updated = [...lineItems];
    updated[parentIndex].subItems = updated[parentIndex].subItems!.filter((_, i) => i !== subIndex);
    updated[parentIndex].line_total = calculateLineTotal(updated[parentIndex]);
    setLineItems(updated);
  };

  const toggleExpanded = (index: number) => {
    const updated = [...lineItems];
    updated[index].expanded = !updated[index].expanded;
    setLineItems(updated);
  };

  const handlePriceBookSelect = (item: any) => {
    if (selectedParentIndex !== null) {
      // Add as sub-item
      const updated = [...lineItems];
      if (!updated[selectedParentIndex].subItems) {
        updated[selectedParentIndex].subItems = [];
      }
      updated[selectedParentIndex].subItems!.push({
        description: item.description,
        quantity: "1",
        cost_price: item.cost_price.toString(),
        margin_percentage: item.margin_percentage.toString(),
        sell_price: item.sell_price.toString(),
        line_total: item.sell_price,
      });
      updated[selectedParentIndex].expanded = true;
      updated[selectedParentIndex].line_total = calculateLineTotal(updated[selectedParentIndex]);
      setLineItems(updated);
    } else {
      // Add as line item
      setLineItems([...lineItems, {
        description: item.description,
        quantity: "1",
        cost_price: item.cost_price.toString(),
        margin_percentage: item.margin_percentage.toString(),
        sell_price: item.sell_price.toString(),
        line_total: item.sell_price,
        subItems: [],
        expanded: false,
      }]);
    }
    setSelectedParentIndex(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !quoteId) return;

    setUploadingFiles(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile.tenant_id}/${quoteId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('quote-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('quote-attachments')
          .getPublicUrl(fileName);

        const { data: attachment, error: attachmentError } = await supabase
          .from('quote_attachments')
          .insert({
            quote_id: quoteId,
            tenant_id: profile.tenant_id,
            file_name: file.name,
            file_url: fileName,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          })
          .select()
          .single();

        if (attachmentError) throw attachmentError;

        setAttachments(prev => [attachment, ...prev]);
      }

      toast({ title: "Files uploaded successfully" });
    } catch (error: any) {
      toast({
        title: "Error uploading files",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('quote-attachments')
        .remove([fileUrl]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('quote_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) throw dbError;

      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      toast({ title: "Attachment deleted" });
    } catch (error: any) {
      toast({
        title: "Error deleting attachment",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const taxRate = parseFloat(formData.tax_rate) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
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

      // Get user's tenant_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
        toast({ 
          title: "Error fetching profile", 
          description: profileError.message,
          variant: "destructive" 
        });
        return;
      }

      if (!profile?.tenant_id) {
        toast({ 
          title: "No tenant found", 
          description: "Your account is not associated with a tenant",
          variant: "destructive" 
        });
        return;
      }

      const { subtotal, taxAmount, total } = calculateTotals();

      const quoteData: any = {
        tenant_id: profile.tenant_id,
        customer_id: isForLead ? null : formData.customer_id || null,
        lead_id: isForLead ? formData.lead_id || null : null,
        is_for_lead: isForLead,
        title: formData.title,
        description: formData.description || null,
        valid_until: formData.valid_until || null,
        quote_type: isComplexQuote ? 'complex' : 'simple',
        subtotal,
        tax_rate: parseFloat(formData.tax_rate) || 0,
        tax_amount: taxAmount,
        total_amount: total,
        notes: formData.notes || null,
        terms_conditions: formData.terms_conditions || null,
        internal_notes: formData.internal_notes || null,
        pipeline_id: formData.pipeline_id || null,
        stage_id: formData.stage_id || null,
      };

      let savedQuoteId = quoteId;

      if (quoteId) {
        // For updates, remove tenant_id (it should never change)
        const { tenant_id, ...updateData } = quoteData;
        const { error } = await supabase.from("quotes").update(updateData).eq("id", quoteId);
        if (error) throw error;

        await supabase.from("quote_line_items").delete().eq("quote_id", quoteId);
      } else {
        quoteData.created_by = user.id;
        
        // Get sequential number from settings
        const { data: sequentialSetting } = await supabase
          .from("sequential_number_settings")
          .select("*")
          .eq("tenant_id", profile?.tenant_id)
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

        quoteData.quote_number = `${prefix}-${String(nextNumber).padStart(numberLength, "0")}`;

        const { data: newQuote, error } = await supabase
          .from("quotes")
          .insert([quoteData])
          .select()
          .single();

        if (error) throw error;
        savedQuoteId = newQuote.id;

        // Update the next number in settings
        if (sequentialSetting) {
          await supabase
            .from("sequential_number_settings")
            .update({ next_number: nextNumber + 1 })
            .eq("id", sequentialSetting.id);
        } else {
          // Create initial setting if it doesn't exist
          await supabase
            .from("sequential_number_settings")
            .insert({
              tenant_id: profile?.tenant_id,
              entity_type: "quote",
              prefix: "QT",
              next_number: 2,
              number_length: 5,
            });
        }
      }

      // Save line items with hierarchy
      const allItems: any[] = [];
      let itemOrder = 0;

      for (const item of lineItems) {
        const parentItem = {
          quote_id: savedQuoteId,
          tenant_id: profile?.tenant_id,
          item_order: itemOrder++,
          description: item.description,
          quantity: parseFloat(item.quantity),
          cost_price: parseFloat(item.cost_price),
          margin_percentage: parseFloat(item.margin_percentage),
          sell_price: parseFloat(item.sell_price),
          line_total: item.line_total,
          unit_price: parseFloat(item.sell_price), // For compatibility
        };

        const { data: savedParent, error: parentError } = await supabase
          .from("quote_line_items")
          .insert([parentItem])
          .select()
          .single();

        if (parentError) throw parentError;

        // Save sub-items
        if (item.subItems && item.subItems.length > 0) {
          for (const subItem of item.subItems) {
            allItems.push({
              quote_id: savedQuoteId,
              tenant_id: profile?.tenant_id,
              parent_line_item_id: savedParent.id,
              item_order: itemOrder++,
              description: subItem.description,
              quantity: parseFloat(subItem.quantity),
              cost_price: parseFloat(subItem.cost_price),
              margin_percentage: parseFloat(subItem.margin_percentage),
              sell_price: parseFloat(subItem.sell_price),
              line_total: subItem.line_total,
              unit_price: parseFloat(subItem.sell_price),
            });
          }
        }
      }

      if (allItems.length > 0) {
        const { error: subItemsError } = await supabase
          .from("quote_line_items")
          .insert(allItems);

        if (subItemsError) throw subItemsError;
      }

      toast({ title: `Quote ${quoteId ? "updated" : "created"} successfully` });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", savedQuoteId] });
      queryClient.invalidateQueries({ queryKey: ["quote-line-items"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error saving quote",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  const hasSubItems = (item: LineItem) => item.subItems && item.subItems.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{quoteId ? "Edit" : "Create"} Quote</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {!leadId && (
                <div className="space-y-2">
                  <Label>Quote For</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="for-customer"
                        checked={!isForLead}
                        onChange={() => {
                          setIsForLead(false);
                          setFormData({ ...formData, lead_id: "", customer_id: "" });
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="for-customer" className="font-normal cursor-pointer">Customer</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="for-lead"
                        checked={isForLead}
                        onChange={() => {
                          setIsForLead(true);
                          setFormData({ ...formData, customer_id: "", lead_id: "" });
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="for-lead" className="font-normal cursor-pointer">Lead</Label>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="customer_or_lead">{isForLead ? "Lead" : "Customer"} *</Label>
                  {isForLead && !leadId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateLeadOpen(true)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create Lead
                    </Button>
                  )}
                </div>
                <SelectWithSearch
                  value={isForLead ? formData.lead_id : formData.customer_id}
                  onValueChange={(value) => {
                    console.log('[QuoteDialog] Select onValueChange:', value, 'isForLead:', isForLead);
                    setFormData({ 
                      ...formData, 
                      [isForLead ? "lead_id" : "customer_id"]: value 
                    });
                  }}
                  options={(isForLead ? leads : customers).map((item) => ({
                    value: item.id,
                    label: `${item.name}${item.company_name ? ` (${item.company_name})` : ''}`
                  }))}
                  placeholder={`Select ${isForLead ? "lead" : "customer"}`}
                  searchPlaceholder={`Search ${isForLead ? "leads" : "customers"}...`}
                  className={errors.customer_id ? "border-red-500" : ""}
                />
                {errors.customer_id && <p className="text-sm text-red-500">{errors.customer_id}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="valid_until">Valid Until</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pipeline">Pipeline</Label>
                <Select
                  value={formData.pipeline_id}
                  onValueChange={(value) => {
                    setFormData({ 
                      ...formData, 
                      pipeline_id: value,
                      stage_id: '' // Reset stage when pipeline changes
                    });
                  }}
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
                <Label htmlFor="stage">Stage</Label>
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

              <div className="space-y-2">
                <Label htmlFor="quote_type" className="flex items-center gap-2">
                  Quote Type
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-muted-foreground">Simple</span>
                    <Switch
                      checked={isComplexQuote}
                      onCheckedChange={setIsComplexQuote}
                    />
                    <span className="text-sm text-muted-foreground">Complex</span>
                  </div>
                </Label>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDescriptionTemplateDialogOpen(true)}
                >
                  Manage Templates
                </Button>
              </div>
              <RichTextEditor
                value={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Enter a description..."
              />
              {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Line Items {isComplexQuote && "& Takeoffs"}</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setSelectedParentIndex(null);
                      setPriceBookOpen(true);
                    }}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Price Book
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setTemplatesDialogOpen(true)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Load Template
                  </Button>
                  {lineItems.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setSaveTemplateOpen(true)}>
                      <Save className="mr-2 h-4 w-4" />
                      Save as Template
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {isComplexQuote && <TableHead className="w-[40px]"></TableHead>}
                      <TableHead className="min-w-[300px]">Description</TableHead>
                      <TableHead className="w-[100px] text-right">Quantity</TableHead>
                      {isComplexQuote && (
                        <>
                          <TableHead className="w-[120px] text-right">Cost</TableHead>
                          <TableHead className="w-[100px] text-right">Margin %</TableHead>
                          <TableHead className="w-[120px] text-right">Sell</TableHead>
                        </>
                       )}
                      {!isComplexQuote && (
                        <>
                          <TableHead className="w-[120px] text-right">Cost</TableHead>
                          <TableHead className="w-[100px] text-right">Margin %</TableHead>
                          <TableHead className="w-[120px] text-right">Sell</TableHead>
                        </>
                      )}
                      <TableHead className="w-[120px] text-right">Total</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <>
                        <TableRow key={index} className="border-b">
                          {isComplexQuote && (
                            <TableCell>
                              {hasSubItems(item) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => toggleExpanded(index)}
                                >
                                  {item.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(index, "description", e.target.value)}
                              placeholder="Item description"
                              className="border-0 focus-visible:ring-0 bg-transparent"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="border-0 focus-visible:ring-0 text-right bg-transparent"
                            />
                          </TableCell>
                          {isComplexQuote && (
                            <>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.cost_price}
                                  onChange={(e) => updateLineItem(index, "cost_price", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  disabled={hasSubItems(item)}
                                  className="border-0 focus-visible:ring-0 text-right bg-transparent disabled:opacity-50"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.margin_percentage}
                                  onChange={(e) => updateLineItem(index, "margin_percentage", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  disabled={hasSubItems(item)}
                                  className={`border-0 focus-visible:ring-0 text-right bg-transparent disabled:opacity-50 transition-colors ${
                                    updatedFields[`${index}-margin_percentage`] ? 'bg-primary/20 animate-pulse' : ''
                                  }`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.sell_price}
                                  onChange={(e) => updateLineItem(index, "sell_price", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  disabled={hasSubItems(item)}
                                  className={`border-0 focus-visible:ring-0 text-right bg-transparent disabled:opacity-50 transition-colors ${
                                    updatedFields[`${index}-sell_price`] ? 'bg-primary/20 animate-pulse' : ''
                                  }`}
                                />
                              </TableCell>
                            </>
                          )}
                          {!isComplexQuote && (
                            <>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.cost_price}
                                  onChange={(e) => updateLineItem(index, "cost_price", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className="border-0 focus-visible:ring-0 text-right bg-transparent"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.margin_percentage}
                                  onChange={(e) => updateLineItem(index, "margin_percentage", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`border-0 focus-visible:ring-0 text-right bg-transparent transition-colors ${
                                    updatedFields[`${index}-margin_percentage`] ? 'bg-primary/20 animate-pulse' : ''
                                  }`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.sell_price}
                                  onChange={(e) => updateLineItem(index, "sell_price", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`border-0 focus-visible:ring-0 text-right bg-transparent transition-colors ${
                                    updatedFields[`${index}-sell_price`] ? 'bg-primary/20 animate-pulse' : ''
                                  }`}
                                />
                              </TableCell>
                            </>
                          )}
                          <TableCell className={`text-right font-medium transition-colors ${
                            updatedFields[`${index}-line_total`] ? 'bg-primary/10 animate-pulse' : ''
                          }`}>
                            {formatCurrency(item.line_total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {isComplexQuote && (
                                <>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setSelectedParentIndex(index);
                                      setPriceBookOpen(true);
                                    }}
                                    title="Add from price book"
                                  >
                                    <BookOpen className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => addSubItem(index)}
                                    title="Add sub-item"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeLineItem(index)}
                                disabled={lineItems.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Sub-items */}
                        {isComplexQuote && item.expanded && item.subItems && item.subItems.length > 0 && (
                          item.subItems.map((subItem, subIndex) => (
                            <TableRow key={`${index}-${subIndex}`} className="bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell className="pl-12">
                                <Input
                                  value={subItem.description}
                                  onChange={(e) => updateSubItem(index, subIndex, "description", e.target.value)}
                                  placeholder="Sub-item description"
                                  className="border-0 focus-visible:ring-0 text-sm bg-transparent"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={subItem.quantity}
                                  onChange={(e) => updateSubItem(index, subIndex, "quantity", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className="border-0 focus-visible:ring-0 text-right text-sm bg-transparent"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={subItem.cost_price}
                                  onChange={(e) => updateSubItem(index, subIndex, "cost_price", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className="border-0 focus-visible:ring-0 text-right text-sm bg-transparent"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={subItem.margin_percentage}
                                  onChange={(e) => updateSubItem(index, subIndex, "margin_percentage", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`border-0 focus-visible:ring-0 text-right text-sm bg-transparent transition-colors ${
                                    updatedFields[`${index}-${subIndex}-margin_percentage`] ? 'bg-primary/20 animate-pulse' : ''
                                  }`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={subItem.sell_price}
                                  onChange={(e) => updateSubItem(index, subIndex, "sell_price", e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className={`border-0 focus-visible:ring-0 text-right text-sm bg-transparent transition-colors ${
                                    updatedFields[`${index}-${subIndex}-sell_price`] ? 'bg-primary/20 animate-pulse' : ''
                                  }`}
                                />
                              </TableCell>
                              <TableCell className={`text-right text-sm transition-colors ${
                                updatedFields[`${index}-${subIndex}-line_total`] ? 'bg-primary/10 animate-pulse' : ''
                              }`}>
                                {formatCurrency(subItem.line_total)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeSubItem(index, subIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({formData.tax_rate}%):</span>
                <span className="font-medium">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="terms_conditions">Terms & Conditions</Label>
                {termsTemplates.length > 0 && (
                  <Select onValueChange={(value) => {
                    const template = termsTemplates.find(t => t.id === value);
                    if (template) {
                      setFormData({ ...formData, terms_conditions: template.content });
                    }
                  }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Load template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {termsTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Textarea
                id="terms_conditions"
                value={formData.terms_conditions}
                onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
                placeholder="Enter terms and conditions..."
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="border-t pt-6 space-y-4">
              <div>
                <Label className="text-base font-semibold">Internal Only</Label>
                <p className="text-sm text-muted-foreground">These fields are not visible to customers</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal_notes">Internal Notes</Label>
                <Textarea
                  id="internal_notes"
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                  placeholder="Add internal notes, comments, or reminders..."
                  rows={4}
                  className="resize-none whitespace-pre-wrap"
                />
              </div>

              {quoteId && (
                <div className="space-y-2">
                  <Label>Internal Attachments</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="file-upload"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={uploadingFiles}
                      >
                        {uploadingFiles ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Upload Files
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Upload documents, images, or other files
                      </p>
                    </div>

                    {attachments.length > 0 && (
                      <div className="border rounded-lg divide-y">
                        {attachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAttachment(attachment.id, attachment.file_url)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {!quoteId && (
                <p className="text-sm text-muted-foreground italic">
                  Save the quote first to upload attachments
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {quoteId ? "Update" : "Create"} Quote
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <PriceBookDialog 
        open={priceBookOpen} 
        onOpenChange={setPriceBookOpen}
        onSelectItem={handlePriceBookSelect}
        allowAssemblies={isComplexQuote}
      />

      <AILineItemMatcher
        open={aiMatcherOpen}
        onOpenChange={setAiMatcherOpen}
        onItemsMatched={(items) => {
          const newItems = items.map(item => ({
            description: item.description,
            quantity: item.quantity.toString(),
            cost_price: item.cost_price.toString(),
            margin_percentage: item.margin_percentage.toString(),
            sell_price: item.sell_price.toString(),
            line_total: item.quantity * item.sell_price,
            subItems: [],
            expanded: false,
          }));
          setLineItems([...lineItems, ...newItems]);
        }}
        tenantId={tenantId}
      />

      <CreateLeadDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        onLeadCreated={(leadId, leadName) => {
          setFormData({ ...formData, lead_id: leadId });
          fetchCustomersAndLeads();
          toast({ title: `Lead "${leadName}" created and selected` });
        }}
      />

      <QuoteItemTemplatesDialog
        open={templatesDialogOpen}
        onOpenChange={setTemplatesDialogOpen}
        onSelectTemplate={async (templateId) => {
          try {
            // Fetch template lines
            const { data: templateLines, error } = await supabase
              .from('quote_item_template_lines')
              .select('*')
              .eq('template_id', templateId)
              .order('item_order');

            if (error) throw error;

            if (templateLines && templateLines.length > 0) {
              // Build hierarchical structure
              const parentLines = templateLines.filter(line => !line.parent_line_item_id);
              const newItems = parentLines.map((parent: any) => {
                const subItems = templateLines
                  .filter((line: any) => line.parent_line_item_id === parent.id)
                  .map((sub: any) => ({
                    description: sub.description,
                    quantity: sub.quantity.toString(),
                    cost_price: sub.cost_price.toString(),
                    margin_percentage: sub.margin_percentage.toString(),
                    sell_price: sub.sell_price.toString(),
                    line_total: sub.quantity * sub.sell_price,
                  }));

                return {
                  description: parent.description,
                  quantity: parent.quantity.toString(),
                  cost_price: parent.cost_price.toString(),
                  margin_percentage: parent.margin_percentage.toString(),
                  sell_price: parent.sell_price.toString(),
                  line_total: parent.quantity * parent.sell_price,
                  subItems,
                  expanded: subItems.length > 0,
                };
              });

              setLineItems([...lineItems, ...newItems]);
              toast({ title: 'Template loaded successfully' });
            }
          } catch (error: any) {
            toast({
              title: 'Error loading template',
              description: error.message,
              variant: 'destructive',
            });
          }
        }}
      />

      <SaveAsTemplateDialog
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        lineItems={lineItems}
        quoteType={isComplexQuote ? 'complex' : 'simple'}
      />

      <QuoteDescriptionTemplateDialog
        open={descriptionTemplateDialogOpen}
        onOpenChange={setDescriptionTemplateDialogOpen}
        currentDescription={formData.description}
        onSelectDescription={(description) => setFormData({ ...formData, description })}
        tenantId={tenantId}
      />
    </>
  );
}
