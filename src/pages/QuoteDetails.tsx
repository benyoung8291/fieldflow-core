import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DocumentDetailLayout, {
  DocumentAction,
  FileMenuAction,
  StatusBadge,
  TabConfig,
} from "@/components/layout/DocumentDetailLayout";
import KeyInfoCard from "@/components/layout/KeyInfoCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Edit,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  Download,
  Lock,
  Mail,
  RefreshCw,
  Trash2,
  User,
  DollarSign,
  ListChecks,
  TrendingUp,
  History,
  Save,
  Info,
  Folder,
  Upload,
  Eye,
  Tag,
  AlertCircle,
  Briefcase,
  FolderKanban,
} from "lucide-react";
import InlineQuoteLineItems from "@/components/quotes/InlineQuoteLineItems";
import QuoteDialog from "@/components/quotes/QuoteDialog";
import QuotePDFDialog from "@/components/quotes/QuotePDFDialog";
import ConvertQuoteDialog from "@/components/quotes/ConvertQuoteDialog";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import AuditTimeline from "@/components/audit/AuditTimeline";
import { LinkedHelpdeskTicketsTab } from "@/components/helpdesk/LinkedHelpdeskTicketsTab";
import { LinkedDocumentsTimeline } from "@/components/audit/LinkedDocumentsTimeline";
import QuoteVersionHistory from "@/components/quotes/QuoteVersionHistory";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { usePresence } from "@/hooks/usePresence";
import { useDocumentRealtime } from "@/hooks/useDocumentRealtime";
import { useCollaborativeField } from "@/hooks/useCollaborativeField";
import FieldPresenceWrapper from "@/components/presence/FieldPresenceWrapper";
import PresencePanel from "@/components/presence/PresencePanel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function QuoteDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversionType, setConversionType] = useState<'project' | 'service_order' | 'contract' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Real-time collaboration setup
  const { 
    onlineUsers, 
    startTyping, 
    stopTyping, 
    updateField,
    currentUser 
  } = usePresence({ 
    page: `quote-${id}`,
  });

  // Listen for real-time document updates
  useDocumentRealtime({
    table: "quotes",
    id,
    queryKey: ["quote", id],
    onUpdate: (payload) => {
      console.log("Quote updated by another user:", payload);
      toast({
        title: "Document updated",
        description: "Another user made changes to this quote",
      });
    },
  });

  // Inline edit state
  const [editedFields, setEditedFields] = useState({
    title: "",
    description: "",
    notes: "",
    terms_conditions: "",
    internal_notes: "",
  });

  // Line items state
  const [editedLineItems, setEditedLineItems] = useState<any[]>([]);

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      const { data: quoteData, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const { data: customer } = await supabase
        .from("customers")
        .select("id, name, email, phone")
        .eq("id", quoteData.customer_id)
        .maybeSingle();

      const { data: creator } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", quoteData.created_by)
        .maybeSingle();

      return { ...quoteData, customer, creator };
    },
  });

  const { data: lineItems, isLoading: lineItemsLoading } = useQuery({
    queryKey: ["quote-line-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", id)
        .order("item_order");

      if (error) throw error;
      return data;
    },
  });

  const { data: attachments, refetch: refetchAttachments } = useQuery({
    queryKey: ["quote-attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_attachments")
        .select("*")
        .eq("quote_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch lead information if quote is linked to a lead
  const { data: leadInfo } = useQuery({
    queryKey: ["quote-lead", quote?.lead_id],
    queryFn: async () => {
      if (!quote?.lead_id) return null;
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", quote.lead_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!quote?.lead_id,
  });

  // Fetch tasks and count overdue
  const { data: tasks } = useQuery({
    queryKey: ["quote-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("linked_module", "quote")
        .eq("linked_record_id", id)
        .neq("status", "completed");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch helpdesk tickets count
  const { data: helpdeskTickets } = useQuery({
    queryKey: ["quote-helpdesk-count", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_linked_documents")
        .select("id")
        .eq("document_type", "quote")
        .eq("document_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch linked documents count
  const { data: linkedDocs } = useQuery({
    queryKey: ["quote-linked-docs-count", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id")
        .eq("table_name", "quotes")
        .eq("record_id", id)
        .ilike("note", "%linked%");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const overdueTasksCount = tasks?.filter((task) => {
    if (task.status === "completed") return false;
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    if (!dueDate) return false;
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    return dueDate <= threeDaysFromNow;
  }).length || 0;

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

  // Initialize edited fields when quote loads
  useEffect(() => {
    if (quote) {
      setEditedFields({
        title: quote.title || "",
        description: quote.description || "",
        notes: quote.notes || "",
        terms_conditions: quote.terms_conditions || "",
        internal_notes: quote.internal_notes || "",
      });
    }
  }, [quote]);

  // Check if any fields have changed
  const hasChanges = () => {
    if (!quote) return false;
    
    return (
      editedFields.title !== (quote.title || "") ||
      editedFields.description !== (quote.description || "") ||
      editedFields.notes !== (quote.notes || "") ||
      editedFields.terms_conditions !== (quote.terms_conditions || "") ||
      editedFields.internal_notes !== (quote.internal_notes || "")
    );
  };

  // Initialize line items for editing
  useEffect(() => {
    if (lineItems && lineItems.length > 0) {
      // Organize line items into parent-child structure
      const parents = lineItems.filter((item: any) => !item.parent_line_item_id);
      const organized = parents.map((parent: any) => {
        const subItems = lineItems
          .filter((item: any) => item.parent_line_item_id === parent.id)
          .map((sub: any) => ({
            id: sub.id,
            description: sub.description,
            quantity: sub.quantity.toString(),
            cost_price: sub.cost_price.toString(),
            margin_percentage: sub.margin_percentage.toString(),
            sell_price: sub.sell_price.toString(),
            line_total: sub.line_total,
          }));

        return {
          id: parent.id,
          description: parent.description,
          quantity: parent.quantity.toString(),
          cost_price: parent.cost_price.toString(),
          margin_percentage: parent.margin_percentage.toString(),
          sell_price: parent.sell_price.toString(),
          line_total: parent.line_total,
          subItems,
          expanded: subItems.length > 0,
        };
      });
      setEditedLineItems(organized);
    }
  }, [lineItems]);

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
  });

  // Fetch stages for selected pipeline
  const { data: stages = [] } = useQuery({
    queryKey: ["crm-stages", quote?.pipeline_id],
    queryFn: async () => {
      if (!quote?.pipeline_id) return [];

      const { data, error } = await supabase
        .from("crm_status_settings")
        .select("*")
        .eq("pipeline_id", quote.pipeline_id)
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!quote?.pipeline_id,
  });

  const handleDownloadAttachment = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('quote-attachments')
        .download(fileUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error downloading file",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    try {
      setUploadingFile(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${profile.tenant_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('quote-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('quote_attachments')
        .insert({
          quote_id: id,
          tenant_id: profile.tenant_id,
          file_name: file.name,
          file_url: filePath,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      toast({ title: "File uploaded successfully" });
      refetchAttachments();
      
      // Reset input
      event.target.value = '';
    } catch (error: any) {
      toast({
        title: "Error uploading file",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('quote-attachments')
        .remove([fileUrl]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('quote_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) throw dbError;

      toast({ title: "Attachment deleted successfully" });
      refetchAttachments();
    } catch (error: any) {
      toast({
        title: "Error deleting attachment",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      // Validate line items if changing status away from draft
      if (quote?.status === "draft" && newStatus !== "draft") {
        // Check if there are any line items (use editedLineItems for current state)
        if (!editedLineItems || editedLineItems.length === 0) {
          toast({
            title: "Cannot change status",
            description: "Please add at least one line item before changing status",
            variant: "destructive",
          });
          return;
        }

        // Validate all line items are complete (use editedLineItems, not lineItems)
        const incompleteItems: string[] = [];
        
        editedLineItems.forEach((item: any, index: number) => {
          const issues: string[] = [];
          
          if (!item.description || item.description.trim() === "") {
            issues.push("missing description");
          }
          
          const qty = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;
          if (isNaN(qty) || qty <= 0) {
            issues.push("invalid quantity");
          }
          
          const cost = typeof item.cost_price === 'string' ? parseFloat(item.cost_price) : item.cost_price;
          if (isNaN(cost) || cost < 0) {
            issues.push("invalid cost");
          }
          
          const sell = typeof item.sell_price === 'string' ? parseFloat(item.sell_price) : item.sell_price;
          if (isNaN(sell) || sell <= 0) {
            issues.push("invalid sell price");
          }
          
          if (issues.length > 0) {
            incompleteItems.push(`Line ${index + 1}: ${issues.join(", ")}`);
          }
        });

        // Check for sub-items (nested line items with parent_line_item_id)
        const subItems = editedLineItems.filter((item: any) => item.parent_line_item_id);
        subItems.forEach((subItem: any, subIndex: number) => {
          const subIssues: string[] = [];
          
          if (!subItem.description || subItem.description.trim() === "") {
            subIssues.push("missing description");
          }
          
          const subQty = typeof subItem.quantity === 'string' ? parseFloat(subItem.quantity) : subItem.quantity;
          if (isNaN(subQty) || subQty <= 0) {
            subIssues.push("invalid quantity");
          }
          
          const subCost = typeof subItem.cost_price === 'string' ? parseFloat(subItem.cost_price) : subItem.cost_price;
          if (isNaN(subCost) || subCost < 0) {
            subIssues.push("invalid cost");
          }
          
          const subSell = typeof subItem.sell_price === 'string' ? parseFloat(subItem.sell_price) : subItem.sell_price;
          if (isNaN(subSell) || subSell <= 0) {
            subIssues.push("invalid sell price");
          }
          
          if (subIssues.length > 0) {
            incompleteItems.push(`Sub-item ${subIndex + 1}: ${subIssues.join(", ")}`);
          }
        });

        if (incompleteItems.length > 0) {
          toast({
            title: "Incomplete line items",
            description: incompleteItems.slice(0, 3).join("; ") + (incompleteItems.length > 3 ? `... and ${incompleteItems.length - 3} more` : ""),
            variant: "destructive",
          });
          return;
        }
      }

      const updates: any = { status: newStatus };

      if (newStatus === "sent") updates.sent_at = new Date().toISOString();
      if (newStatus === "approved") updates.approved_at = new Date().toISOString();
      if (newStatus === "rejected") updates.rejected_at = new Date().toISOString();

      const { error } = await supabase.from("quotes").update(updates).eq("id", id);

      if (error) throw error;

      // Log status change to audit trail
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id, first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          const userName = `${profile.first_name} ${profile.last_name}`;
          await supabase.from("audit_logs").insert({
            table_name: "quotes",
            record_id: id!,
            action: "update",
            field_name: "status",
            old_value: quote?.status || null,
            new_value: newStatus,
            user_id: user.id,
            user_name: userName,
            tenant_id: profile.tenant_id,
          });
        }
      }

      toast({ title: `Quote ${newStatus} successfully` });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (error: any) {
      toast({
        title: "Error updating quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updatePipelineStage = async (field: 'pipeline_id' | 'stage_id', value: string) => {
    try {
      const oldValue = field === 'pipeline_id' ? quote?.pipeline_id : quote?.stage_id;
      
      const updates: any = { [field]: value };
      
      // If updating pipeline, reset stage
      if (field === 'pipeline_id') {
        updates.stage_id = null;
      }

      const { error } = await supabase.from("quotes").update(updates).eq("id", id);

      if (error) throw error;

      // Log pipeline/stage change to audit trail
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id, first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          const userName = `${profile.first_name} ${profile.last_name}`;
          await supabase.from("audit_logs").insert({
            table_name: "quotes",
            record_id: id!,
            action: "update",
            field_name: field,
            old_value: oldValue || null,
            new_value: value,
            user_id: user.id,
            user_name: userName,
            tenant_id: profile.tenant_id,
          });
        }
      }

      toast({ title: `Quote ${field === 'pipeline_id' ? 'pipeline' : 'stage'} updated` });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch (error: any) {
      toast({
        title: "Error updating quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveInlineEdits = async () => {
    try {
      setIsSaving(true);

      // Get user profile for tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      const userName = `${profile.first_name} ${profile.last_name}`;

      // Track changes for audit logging
      const changedFields: { field: string; oldValue: any; newValue: any }[] = [];
      
      if (quote) {
        // Check each editable field for changes
        if (editedFields.title !== quote.title) {
          changedFields.push({ field: 'title', oldValue: quote.title, newValue: editedFields.title });
        }
        if (editedFields.description !== quote.description) {
          changedFields.push({ field: 'description', oldValue: quote.description, newValue: editedFields.description });
        }
        if (editedFields.notes !== quote.notes) {
          changedFields.push({ field: 'notes', oldValue: quote.notes, newValue: editedFields.notes });
        }
        if (editedFields.terms_conditions !== quote.terms_conditions) {
          changedFields.push({ field: 'terms_conditions', oldValue: quote.terms_conditions, newValue: editedFields.terms_conditions });
        }
        if (editedFields.internal_notes !== quote.internal_notes) {
          changedFields.push({ field: 'internal_notes', oldValue: quote.internal_notes, newValue: editedFields.internal_notes });
        }
      }

      // Update quote fields
      const { error: quoteError } = await supabase
        .from("quotes")
        .update(editedFields)
        .eq("id", id);

      if (quoteError) throw quoteError;

      // Create audit log entries for changed fields
      for (const change of changedFields) {
        await supabase.from("audit_logs").insert({
          table_name: "quotes",
          record_id: id!,
          action: "update",
          field_name: change.field,
          old_value: change.oldValue?.toString() || null,
          new_value: change.newValue?.toString() || null,
          user_id: user.id,
          user_name: userName,
          tenant_id: profile.tenant_id,
        });
      }

      // Update line items - delete all and recreate
      await supabase.from("quote_line_items").delete().eq("quote_id", id);

      const allItems: any[] = [];
      let itemOrder = 0;

      for (const item of editedLineItems) {
        const parentItem = {
          quote_id: id,
          tenant_id: profile.tenant_id,
          item_order: itemOrder++,
          description: item.description,
          quantity: parseFloat(item.quantity),
          cost_price: parseFloat(item.cost_price),
          margin_percentage: parseFloat(item.margin_percentage),
          sell_price: parseFloat(item.sell_price),
          line_total: item.line_total,
          unit_price: parseFloat(item.sell_price),
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
              quote_id: id,
              tenant_id: profile.tenant_id,
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

      // Recalculate quote totals
      const subtotal = editedLineItems.reduce((sum, item) => sum + item.line_total, 0);
      const taxRate = parseFloat(quote?.tax_rate?.toString() || "10");
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      await supabase
        .from("quotes")
        .update({
          subtotal,
          tax_amount: taxAmount,
          total_amount: total,
        })
        .eq("id", id);

      toast({ title: "Quote saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote-line-items", id] });
    } catch (error: any) {
      toast({
        title: "Error saving quote",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      // Log archiving to audit trail
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id, first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          const userName = `${profile.first_name} ${profile.last_name}`;
          await supabase.from("audit_logs").insert({
            table_name: "quotes",
            record_id: id!,
            action: "update",
            field_name: "status",
            old_value: quote?.status || null,
            new_value: "archived",
            user_id: user.id,
            user_name: userName,
            tenant_id: profile.tenant_id,
          });
        }
      }

      const { error } = await supabase
        .from("quotes")
        .update({ 
          status: "archived",
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Quote archived successfully" });
      navigate("/quotes");
    } catch (error: any) {
      toast({
        title: "Error archiving quote",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Status badges
  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "secondary",
    sent: "default",
    approved: "default",
    rejected: "destructive",
    expired: "outline",
    converted: "default",
  };

  const isDraft = quote?.status === "draft";
  const isSent = quote?.status === "sent";
  const isApproved = quote?.status === "approved";
  const isConverted = !!(quote?.converted_to_service_order_id || quote?.converted_to_project_id || quote?.converted_to_contract_id);
  const canEdit = isDraft && !isConverted;
  const hasLead = !!quote?.lead_id && !quote?.customer_id;

  const statusBadges: StatusBadge[] = [
    {
      label: quote?.status || "",
      variant: statusColors[quote?.status || "draft"],
    },
    ...(isConverted ? [{
      label: "Locked",
      variant: "outline" as const,
    }] : []),
  ];

  // Quick status change dropdown component
  const statusChangeDropdown = !isConverted && (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Status:</span>
      <Select value={quote?.status} onValueChange={(value) => updateStatus(value as any)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">
            <div className="flex items-center gap-2">
              <Edit className="h-3 w-3" />
              <span>Draft</span>
            </div>
          </SelectItem>
          <SelectItem value="sent">
            <div className="flex items-center gap-2">
              <Send className="h-3 w-3" />
              <span>Sent</span>
            </div>
          </SelectItem>
          <SelectItem value="approved">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3" />
              <span>Approved</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  // Action buttons based on quote status
  const actionButtons: DocumentAction[] = [];

  // Add status dropdown as first action (if applicable)
  if (statusChangeDropdown) {
    actionButtons.push({
      label: "Status",
      icon: null,
      onClick: () => {}, // No-op, the dropdown handles its own interactions
      variant: "outline",
      customRender: statusChangeDropdown,
    } as any); // Type assertion needed for custom render
  }

  // Primary save/approve/convert actions based on status
  if (canEdit && hasChanges()) {
    actionButtons.push({
      label: isSaving ? "Saving..." : "Save Changes",
      icon: <Save className="h-4 w-4" />,
      onClick: handleSaveInlineEdits,
      variant: "default",
    });
  }
  
  if (isSent && !isConverted) {
    actionButtons.push({
      label: "Approve Quote",
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: () => updateStatus("approved"),
      variant: "default",
    });
  }
  
  // Show conversion buttons when approved
  if (isApproved && !isConverted) {
    actionButtons.push({
      label: "Convert to Service Order",
      icon: <Briefcase className="h-4 w-4" />,
      onClick: () => {
        setConversionType('service_order');
        setConvertDialogOpen(true);
      },
      variant: "default",
    });
    
    actionButtons.push({
      label: "Convert to Service Contract",
      icon: <FileText className="h-4 w-4" />,
      onClick: () => {
        setConversionType('contract');
        setConvertDialogOpen(true);
      },
      variant: "default",
    });
    
    actionButtons.push({
      label: "Convert to Project",
      icon: <FolderKanban className="h-4 w-4" />,
      onClick: () => {
        setConversionType('project');
        setConvertDialogOpen(true);
      },
      variant: "default",
    });
  }
  
  // Show disabled conversion buttons in draft/sent status with explanation
  if (!isApproved && !isConverted) {
    actionButtons.push({
      label: isDraft ? "Convert (Approve First)" : "Convert (Send & Approve First)",
      icon: <RefreshCw className="h-4 w-4" />,
      onClick: () => {
        toast({
          title: "Quote must be approved",
          description: isDraft 
            ? "Please send and approve this quote before converting it."
            : "Please approve this quote before converting it.",
          variant: "default",
        });
      },
      variant: "outline",
    });
  }

  // Secondary action buttons (always available unless draft)
  if (!isDraft) {
    actionButtons.push({
      label: "Download PDF",
      icon: <Download className="h-4 w-4" />,
      onClick: () => setPdfDialogOpen(true),
      variant: "outline",
    });
    
    actionButtons.push({
      label: "Email to Customer",
      icon: <Mail className="h-4 w-4" />,
      onClick: () => {
        setEmailMode(true);
        setPdfDialogOpen(true);
      },
      variant: "outline",
    });
  }

  // Change to Draft (if allowed and not converted)
  if (!isDraft && !isConverted) {
    actionButtons.push({
      label: "Change to Draft",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => updateStatus("draft"),
      variant: "outline",
    });
  }

  // Move all file menu actions to header buttons
  if (!isConverted) {
    actionButtons.push({
      label: "Edit in Dialog",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => setDialogOpen(true),
      variant: "outline",
    });
  }

  if (isDraft && !isConverted) {
    actionButtons.push({
      label: "Archive Quote",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => setDeleteDialogOpen(true),
      variant: "outline",
    });
  }

  // Key info section
  const keyInfoSection = quote && (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <KeyInfoCard
          icon={User}
          label={leadInfo ? "Lead" : "Customer"}
          value={leadInfo ? (leadInfo.company_name || leadInfo.name) : (quote.customer?.name || "N/A")}
        />
        <KeyInfoCard
          icon={FileText}
          label="Quote Number"
          value={quote.quote_number}
        />
        <KeyInfoCard
          icon={ListChecks}
          label="Line Items"
          value={lineItems?.length || 0}
        />
        <KeyInfoCard
          icon={DollarSign}
          label="Total Amount"
          value={formatCurrency(quote.total_amount)}
        />
      </div>
      
      {isConverted && (
        <div className="mt-4 p-4 bg-info/10 border border-info/20 rounded-lg flex items-start gap-3">
          <Lock className="h-5 w-5 text-info mt-0.5" />
          <div>
            <p className="font-medium text-info">Quote Locked</p>
            <p className="text-sm text-muted-foreground mt-1">
              This quote has been converted and cannot be edited. To modify this quote, delete the 
              {quote?.converted_to_service_order_id && " service order"}
              {quote?.converted_to_project_id && " project"}
              {quote?.converted_to_contract_id && " contract"}
              {" "}first.
            </p>
          </div>
        </div>
      )}
    </>
  );

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = editedLineItems.reduce((sum, item) => sum + item.line_total, 0);
    const taxRate = parseFloat(quote?.tax_rate?.toString() || "10");
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const { subtotal: calculatedSubtotal, taxAmount: calculatedTax, total: calculatedTotal } = 
    editedLineItems.length > 0 ? calculateTotals() : { subtotal: 0, taxAmount: 0, total: 0 };

  // Tab configurations
  const tabs: TabConfig[] = [
    {
      value: "line-items",
      label: "Line Items",
      icon: <ListChecks className="h-4 w-4" />,
      content: quote && !lineItemsLoading && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle>Line Items</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{editedLineItems?.length || 0} items</Badge>
                <Badge variant="outline">
                  Total: ${calculatedTotal?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || "0.00"}
                </Badge>
                {!canEdit && isConverted && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Locked - Quote Converted
                  </Badge>
                )}
                {!canEdit && !isConverted && !isDraft && (
                  <Badge variant="secondary">
                    Read Only - {quote?.status}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <InlineQuoteLineItems
              lineItems={editedLineItems}
              onChange={setEditedLineItems}
              readOnly={!canEdit}
              defaultMarginPercentage={defaultMarginData || 30}
            />
            
            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">${calculatedSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({quote?.tax_rate || 10}%):</span>
                  <span className="font-medium">${calculatedTax.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span>${calculatedTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      value: "details",
      label: "Details",
      icon: <Info className="h-4 w-4" />,
      content: quote && (
        <Card>
          <CardHeader>
            <CardTitle>Quote Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium">Title</Label>
                {!canEdit && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Read Only
                  </Badge>
                )}
              </div>
              {canEdit ? (
                <Input
                  value={editedFields.title}
                  onChange={(e) => setEditedFields(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter quote title"
                  className="mt-1"
                />
              ) : (
                <p className="text-sm text-muted-foreground mt-1">{quote.title}</p>
              )}
            </div>

            <div className="space-y-6">
              <Label className="text-sm font-medium">Description</Label>
              {canEdit ? (
                <div className="border rounded-md overflow-hidden">
                  <RichTextEditor
                    value={editedFields.description}
                    onChange={(value) => setEditedFields(prev => ({ ...prev, description: value }))}
                    placeholder="Enter quote description"
                  />
                </div>
              ) : quote.description ? (
                <div 
                  className="text-sm text-muted-foreground mt-1 prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: quote.description }}
                />
              ) : null}
            </div>

            <div>
              <Label className="text-sm font-medium">Notes</Label>
              {canEdit ? (
                <Textarea
                  value={editedFields.notes}
                  onChange={(e) => setEditedFields(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Enter notes"
                  className="mt-1"
                  rows={3}
                />
              ) : quote.notes ? (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {quote.notes}
                </p>
              ) : null}
            </div>

            <div>
              <Label className="text-sm font-medium">Terms & Conditions</Label>
              {canEdit ? (
                <Textarea
                  value={editedFields.terms_conditions}
                  onChange={(e) => setEditedFields(prev => ({ ...prev, terms_conditions: e.target.value }))}
                  placeholder="Enter terms and conditions"
                  className="mt-1"
                  rows={3}
                />
              ) : quote.terms_conditions ? (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {quote.terms_conditions}
                </p>
              ) : null}
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">CRM Pipeline</Label>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Pipeline</Label>
                  <Select
                    value={quote.pipeline_id || ''}
                    onValueChange={(value) => updatePipelineStage('pipeline_id', value)}
                    disabled={!isDraft}
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

                <div>
                  <Label className="text-sm font-medium mb-2 block">Stage</Label>
                  <Select
                    value={quote.stage_id || ''}
                    onValueChange={(value) => updatePipelineStage('stage_id', value)}
                    disabled={!isDraft || !quote.pipeline_id || stages.length === 0}
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
            </div>

            <div>
              <Label className="text-sm font-medium">Created</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(quote.created_at), "MMM d, yyyy")}
              </p>
            </div>

            {quote.valid_until && (
              <div>
                <Label className="text-sm font-medium">Valid Until</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(quote.valid_until), "MMM d, yyyy")}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: "customer",
      label: "Customer",
      icon: <User className="h-4 w-4" />,
      content: quote && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Name</Label>
                <p className="text-sm text-muted-foreground">{quote.customer?.name}</p>
              </div>
              {quote.customer?.email && (
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">{quote.customer.email}</p>
                </div>
              )}
              {quote.customer?.phone && (
                <div>
                  <Label className="text-sm font-medium">Phone</Label>
                  <p className="text-sm text-muted-foreground">{quote.customer.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {leadInfo && (
            <Card>
              <CardHeader>
                <CardTitle>Lead Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Company Name</Label>
                  <p className="text-sm text-muted-foreground">{leadInfo.company_name || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Contact Name</Label>
                  <p className="text-sm text-muted-foreground">{leadInfo.name || "N/A"}</p>
                </div>
                {leadInfo.email && (
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm text-muted-foreground">{leadInfo.email}</p>
                  </div>
                )}
                {leadInfo.phone && (
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    <p className="text-sm text-muted-foreground">{leadInfo.phone}</p>
                  </div>
                )}
                {leadInfo.source && (
                  <div>
                    <Label className="text-sm font-medium">Source</Label>
                    <p className="text-sm text-muted-foreground">{leadInfo.source}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      value: "files",
      label: "Files",
      icon: <Folder className="h-4 w-4" />,
      badge: attachments?.length || 0,
      content: quote && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Attachments</CardTitle>
            {canEdit && (
              <div>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploadingFile}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingFile ? "Uploading..." : "Upload File"}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {attachments && attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((attachment: any) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}</span>
                          {attachment.created_at && (
                            <>
                              <span>•</span>
                              <span>{format(new Date(attachment.created_at), "MMM d, yyyy")}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownloadAttachment(attachment.file_url, attachment.file_name)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAttachment(attachment.id, attachment.file_url)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Folder className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No attachments yet</p>
                {canEdit && (
                  <p className="text-xs text-muted-foreground mt-1">Click "Upload File" to add attachments</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: "internal",
      label: "Internal Only",
      icon: <Lock className="h-4 w-4" />,
      content: quote && (
        <Card className="border-orange-200 dark:border-orange-900/50">
          <CardHeader className="bg-orange-50 dark:bg-orange-950/20">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Internal Only
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium">Internal Notes</Label>
                {!canEdit && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Read Only
                  </Badge>
                )}
              </div>
              {canEdit ? (
                <Textarea
                  value={editedFields.internal_notes}
                  onChange={(e) => setEditedFields(prev => ({ ...prev, internal_notes: e.target.value }))}
                  placeholder="Enter internal notes (not visible to customer)"
                  className="mt-1"
                  rows={3}
                />
              ) : quote.internal_notes ? (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {quote.internal_notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">No internal notes</p>
              )}
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      value: "tasks",
      label: "Tasks",
      icon: overdueTasksCount > 0 ? <AlertCircle className="h-4 w-4 text-destructive" /> : <ListChecks className="h-4 w-4" />,
      badge: overdueTasksCount > 0 ? overdueTasksCount : undefined,
      content: <LinkedTasksList linkedModule="quote" linkedRecordId={id!} />,
    },
    {
      value: "versions",
      label: "Version History",
      icon: <History className="h-4 w-4" />,
      content: <QuoteVersionHistory quoteId={id || ""} canRestore={canEdit} />,
    },
    {
      value: "helpdesk",
      label: "Help Desk",
      icon: <Mail className="h-4 w-4" />,
      badge: helpdeskTickets?.length || undefined,
      content: <LinkedHelpdeskTicketsTab documentType="quote" documentId={id!} />,
    },
    {
      value: "linked-documents",
      label: "Linked Documents",
      icon: <FileText className="h-4 w-4" />,
      badge: linkedDocs?.length || undefined,
      content: <LinkedDocumentsTimeline documentType="quote" documentId={id!} />,
    },
    {
      value: "history",
      label: "History",
      icon: <History className="h-4 w-4" />,
      content: <AuditTimeline tableName="quotes" recordId={id!} />,
    },
  ];

  // Format quote number properly - remove leading hyphens and ensure Q prefix
  const formattedQuoteNumber = quote?.quote_number 
    ? (quote.quote_number.startsWith('Q-') 
        ? quote.quote_number 
        : `Q${quote.quote_number.replace(/^-+/, '')}`)
    : '';

  // Determine company name to display
  const companyName = leadInfo 
    ? (leadInfo.company_name || leadInfo.name)
    : quote?.customer?.name;

  return (
    <>
      <DocumentDetailLayout
        title={quote?.title || ""}
        subtitle={`${formattedQuoteNumber} • ${companyName || 'No Customer/Lead'}`}
        backPath="/quotes"
        statusBadges={statusBadges}
        primaryActions={actionButtons}
        keyInfoSection={keyInfoSection}
        tabs={tabs}
        defaultTab="line-items"
        isLoading={isLoading}
        notFoundMessage={!quote ? "Quote not found" : undefined}
      />

      {quote && (
        <>
          <QuoteDialog open={dialogOpen} onOpenChange={setDialogOpen} quoteId={id} />

          <QuotePDFDialog 
            open={pdfDialogOpen} 
            onOpenChange={(open) => {
              setPdfDialogOpen(open);
              if (!open) setEmailMode(false);
            }}
            quoteId={id!}
            customerEmail={quote.customer?.email}
            initialEmailMode={emailMode}
          />

          <ConvertQuoteDialog
            open={convertDialogOpen}
            onOpenChange={(open) => {
              setConvertDialogOpen(open);
              if (!open) setConversionType(null);
            }}
            quote={quote}
            lineItems={lineItems || []}
            initialType={conversionType}
          />

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive Quote</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to archive this quote? You can restore it later if needed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>
                  Archive
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}
