import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Briefcase, ClipboardList, FileCheck, AlertCircle, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import CustomerDialog from '@/components/customers/CustomerDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface ConvertQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: any;
  lineItems: LineItem[];
  initialType?: 'project' | 'service_order' | 'contract' | null;
}

const frequencyOptions = [
  { value: 'one_time', label: 'One Time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annually', label: 'Semi-Annually' },
  { value: 'annually', label: 'Annually' },
];

export default function ConvertQuoteDialog({
  open,
  onOpenChange,
  quote,
  lineItems,
  initialType,
}: ConvertQuoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [conversionType, setConversionType] = useState<'project' | 'service_order' | 'contract'>(initialType || 'project');
  
  // Update conversion type when initialType changes
  useEffect(() => {
    if (initialType) {
      setConversionType(initialType);
    }
  }, [initialType]);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [pendingConversion, setPendingConversion] = useState(false);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);

  // Check if quote has already been converted
  const isConverted = !!(quote?.converted_to_service_order_id || quote?.converted_to_project_id || quote?.converted_to_contract_id);
  const hasCustomer = !!quote?.customer_id;
  const hasLead = !!quote?.lead_id;

  // Fetch lead data if quote is for a lead
  const { data: leadData } = useQuery({
    queryKey: ['lead', quote?.lead_id],
    queryFn: async () => {
      if (!quote?.lead_id) return null;
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', quote.lead_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!quote?.lead_id && open,
  });

  // Project form data
  const [projectData, setProjectData] = useState({
    name: quote?.title || '',
    description: quote?.description || '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    budget: quote?.total_amount || 0,
  });

  // Service Order form data
  const [serviceOrderData, setServiceOrderData] = useState({
    title: quote?.title || '',
    description: quote?.description || '',
    preferred_date: format(new Date(), 'yyyy-MM-dd'),
    preferred_date_start: '',
    preferred_date_end: '',
    billing_type: 'fixed',
    fixed_amount: quote?.total_amount || 0,
  });

  // Service Contract form data
  const [contractData, setContractData] = useState({
    title: quote?.title || '',
    description: quote?.description || '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    billing_frequency: 'monthly',
  });

  // Contract line items with scheduling
  const [contractLineItems, setContractLineItems] = useState(
    lineItems.map((item, index) => ({
      ...item,
      recurrence_frequency: 'monthly' as const,
      first_generation_date: format(new Date(), 'yyyy-MM-dd'),
      is_active: true,
      item_order: index,
    }))
  );

  // Handle successful customer creation
  useEffect(() => {
    if (createdCustomerId && pendingConversion) {
      // Proceed with conversion now that customer exists
      handleConvert();
      setPendingConversion(false);
    }
  }, [createdCustomerId, pendingConversion]);

  // Initialize conversion when dialog opens
  const initiateConversion = () => {
    if (isConverted) {
      toast({
        title: "Already Converted",
        description: "This quote has already been converted. Delete the linked document to convert again.",
        variant: "destructive",
      });
      return;
    }

    if (hasLead && !createdCustomerId) {
      // Need to convert lead to customer first
      setPendingConversion(true);
      setCustomerDialogOpen(true);
    } else {
      // Can convert directly
      handleConvert();
    }
  };

  // Convert to Project mutation
  const convertToProjectMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
      if (!profile?.tenant_id) throw new Error('No tenant found');

      // Use customer from quote or newly created customer
      const customerId = createdCustomerId || quote.customer_id;
      if (!customerId) throw new Error('No customer found');

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: customerId,
          name: projectData.name,
          description: projectData.description,
          start_date: projectData.start_date,
          budget: projectData.budget,
          status: 'planning',
          created_by: user.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;
      if (!project) throw new Error('Failed to create project');

      // Create project line items from quote line items (including sub-items)
      const flattenLineItems = (items: LineItem[], parentId?: string): any[] => {
        const flattened: any[] = [];
        items.forEach((item, index) => {
          const projectLineItem = {
            project_id: project.id,
            tenant_id: profile.tenant_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
            item_order: index,
            parent_line_item_id: parentId,
          };
          flattened.push(projectLineItem);
          
          // Handle sub-items if they exist
          if ((item as any).subItems && Array.isArray((item as any).subItems)) {
            // We'll need to insert parent first to get its ID
            // For now, mark sub-items with a temporary reference
          }
        });
        return flattened;
      };

      // Insert parent line items first
      const parentItems = lineItems.filter(item => !item.id || !(item as any).parent_line_item_id);
      for (let i = 0; i < parentItems.length; i++) {
        const item = parentItems[i];
        const { data: insertedItem, error: lineError } = await supabase
          .from('project_line_items')
          .insert({
            project_id: project.id,
            tenant_id: profile.tenant_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
            item_order: i,
          })
          .select()
          .single();

        if (lineError) throw lineError;

        // Insert sub-items if they exist
        if ((item as any).subItems && Array.isArray((item as any).subItems)) {
          const subItems = (item as any).subItems;
          for (let j = 0; j < subItems.length; j++) {
            const subItem = subItems[j];
            const { error: subLineError } = await supabase
              .from('project_line_items')
              .insert({
                project_id: project.id,
                tenant_id: profile.tenant_id,
                description: subItem.description,
                quantity: subItem.quantity,
                unit_price: subItem.unit_price || subItem.sell_price,
                line_total: subItem.line_total,
                item_order: j,
                parent_line_item_id: insertedItem.id,
              });

            if (subLineError) throw subLineError;
          }
        }
      }

      // Find "Closed Won" stage for the pipeline
      let closedWonStageId = null;
      if (quote.pipeline_id) {
        const { data: closedWonStage } = await supabase
          .from('crm_status_settings')
          .select('id')
          .eq('pipeline_id', quote.pipeline_id)
          .ilike('display_name', '%closed%won%')
          .maybeSingle();
        
        closedWonStageId = closedWonStage?.id || null;
      }

      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ 
          converted_to_project_id: project.id,
          crm_status: 'won',
          customer_id: customerId, // Update customer_id if converted from lead
          ...(closedWonStageId && { stage_id: closedWonStageId }), // Set to Closed Won stage
        } as any)
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      // Link quote to project in helpdesk_linked_documents
      await supabase.from('helpdesk_linked_documents').insert({
        tenant_id: profile.tenant_id,
        ticket_id: project.id,
        document_id: quote.id,
        document_type: 'quote',
        document_number: quote.quote_number,
        created_by: user.id,
      });

      // Add audit log for conversion
      const userName = user.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
        : user.email?.split("@")[0] || "System";

      await supabase.from("audit_logs").insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        user_name: userName,
        table_name: "quotes",
        record_id: quote.id,
        action: "update",
        field_name: "converted_to_project",
        old_value: null,
        new_value: project.id,
        note: `Quote converted to Project: ${projectData.name} (${project.id})`,
      });

      // Create version snapshot
      const { data: existingVersions } = await supabase
        .from("quote_versions")
        .select("version_number")
        .eq("quote_id", quote.id)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = existingVersions && existingVersions.length > 0 
        ? existingVersions[0].version_number + 1 
        : 1;

      await supabase.from("quote_versions").insert({
        quote_id: quote.id,
        version_number: nextVersion,
        title: quote.title,
        description: quote.description,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate || 0,
        tax_amount: quote.tax_amount,
        discount_amount: 0,
        total_amount: quote.total_amount,
        quote_type: 'conversion',
        line_items: lineItems,
        notes: quote.notes,
        terms_conditions: quote.terms_conditions,
        changed_by: user.id,
        change_description: `Snapshot before conversion to Project: ${projectData.name}`,
      } as any);

      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['quote', quote.id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Quote converted to project successfully' });
      onOpenChange(false);
      window.open(`/projects/${project.id}`, '_blank');
    },
    onError: (error: any) => {
      toast({
        title: 'Error converting quote',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Convert to Service Order mutation
  const convertToServiceOrderMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
      if (!profile?.tenant_id) throw new Error('No tenant found');

      // Use customer from quote or newly created customer
      const customerId = createdCustomerId || quote.customer_id;
      if (!customerId) throw new Error('No customer found');

      // Generate order number
      const orderNumber = `SO-${Date.now()}`;

      // Create service order
      const { data: serviceOrder, error: soError } = await supabase
        .from('service_orders')
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: customerId,
          order_number: orderNumber,
          title: serviceOrderData.title,
          description: serviceOrderData.description,
          preferred_date: serviceOrderData.preferred_date,
          preferred_date_start: serviceOrderData.preferred_date_start || null,
          preferred_date_end: serviceOrderData.preferred_date_end || null,
          billing_type: serviceOrderData.billing_type,
          fixed_amount: serviceOrderData.fixed_amount,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (soError) throw soError;
      if (!serviceOrder) throw new Error('Failed to create service order');

      // Create service order line items from quote line items (including sub-items)
      // Insert parent line items first
      const parentItems = lineItems.filter(item => !item.id || !(item as any).parent_line_item_id);
      for (let i = 0; i < parentItems.length; i++) {
        const item = parentItems[i];
        const { data: insertedItem, error: lineError } = await supabase
          .from('service_order_line_items')
          .insert({
            service_order_id: serviceOrder.id,
            tenant_id: profile.tenant_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
            item_order: i,
          })
          .select()
          .single();

        if (lineError) throw lineError;

        // Insert sub-items if they exist
        if ((item as any).subItems && Array.isArray((item as any).subItems)) {
          const subItems = (item as any).subItems;
          for (let j = 0; j < subItems.length; j++) {
            const subItem = subItems[j];
            const { error: subLineError } = await supabase
              .from('service_order_line_items')
              .insert({
                service_order_id: serviceOrder.id,
                tenant_id: profile.tenant_id,
                description: subItem.description,
                quantity: subItem.quantity,
                unit_price: subItem.unit_price || subItem.sell_price,
                line_total: subItem.line_total,
                item_order: j,
                parent_line_item_id: insertedItem.id,
              });

            if (subLineError) throw subLineError;
          }
        }
      }

      // Find "Closed Won" stage for the pipeline
      let closedWonStageId = null;
      if (quote.pipeline_id) {
        const { data: closedWonStage } = await supabase
          .from('crm_status_settings')
          .select('id')
          .eq('pipeline_id', quote.pipeline_id)
          .ilike('display_name', '%closed%won%')
          .maybeSingle();
        
        closedWonStageId = closedWonStage?.id || null;
      }

      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ 
          converted_to_service_order_id: serviceOrder.id,
          crm_status: 'won',
          customer_id: customerId, // Update customer_id if converted from lead
          ...(closedWonStageId && { stage_id: closedWonStageId }), // Set to Closed Won stage
        } as any)
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      // Link quote to service order in helpdesk_linked_documents
      await supabase.from('helpdesk_linked_documents').insert({
        tenant_id: profile.tenant_id,
        ticket_id: serviceOrder.id,
        document_id: quote.id,
        document_type: 'quote',
        document_number: quote.quote_number,
        created_by: user.id,
      });

      // Add audit log for conversion
      const userName = user.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
        : user.email?.split("@")[0] || "System";

      await supabase.from("audit_logs").insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        user_name: userName,
        table_name: "quotes",
        record_id: quote.id,
        action: "update",
        field_name: "converted_to_service_order",
        old_value: null,
        new_value: serviceOrder.id,
        note: `Quote converted to Service Order: ${serviceOrderData.title} (${serviceOrder.id})`,
      });

      // Create version snapshot
      const { data: existingVersions } = await supabase
        .from("quote_versions")
        .select("version_number")
        .eq("quote_id", quote.id)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = existingVersions && existingVersions.length > 0 
        ? existingVersions[0].version_number + 1 
        : 1;

      await supabase.from("quote_versions").insert({
        quote_id: quote.id,
        version_number: nextVersion,
        title: quote.title,
        description: quote.description,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate || 0,
        tax_amount: quote.tax_amount,
        discount_amount: 0,
        total_amount: quote.total_amount,
        quote_type: 'conversion',
        line_items: lineItems,
        notes: quote.notes,
        terms_conditions: quote.terms_conditions,
        changed_by: user.id,
        change_description: `Snapshot before conversion to Service Order: ${serviceOrderData.title}`,
      } as any);

      return serviceOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quote.id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Quote converted to service order successfully' });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error converting quote',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Convert to Service Contract mutation
  const convertToContractMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
      if (!profile?.tenant_id) throw new Error('No tenant found');

      // Use customer from quote or newly created customer
      const customerId = createdCustomerId || quote.customer_id;
      if (!customerId) throw new Error('No customer found');

      // Generate contract number
      const contractNumber = `SC-${Date.now()}`;

      // Calculate total contract value
      const totalValue = contractLineItems.reduce((sum, item) => sum + item.line_total, 0);

      // Create service contract
      const { data: contract, error: contractError } = await supabase
        .from('service_contracts' as any)
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: customerId,
          contract_number: contractNumber,
          title: contractData.title,
          description: contractData.description,
          start_date: contractData.start_date,
          end_date: contractData.end_date || null,
          billing_frequency: contractData.billing_frequency,
          total_contract_value: totalValue,
          status: 'active',
          auto_generate: true,
          created_by: user.id,
          quote_id: quote.id,
        })
        .select()
        .single();

      if (contractError) throw contractError;
      if (!contract) throw new Error('Failed to create service contract');

      // Create contract line items
      const lineItemsToInsert = contractLineItems.map((item) => ({
        contract_id: (contract as any).id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        recurrence_frequency: item.recurrence_frequency,
        first_generation_date: item.first_generation_date,
        next_generation_date: item.first_generation_date,
        is_active: item.is_active,
        item_order: item.item_order,
      }));

      const { error: itemsError } = await supabase
        .from('service_contract_line_items' as any)
        .insert(lineItemsToInsert);

      if (itemsError) throw itemsError;

      // Find "Closed Won" stage for the pipeline
      let closedWonStageId = null;
      if (quote.pipeline_id) {
        const { data: closedWonStage } = await supabase
          .from('crm_status_settings')
          .select('id')
          .eq('pipeline_id', quote.pipeline_id)
          .ilike('display_name', '%closed%won%')
          .maybeSingle();
        
        closedWonStageId = closedWonStage?.id || null;
      }

      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ 
          converted_to_contract_id: (contract as any).id,
          crm_status: 'won',
          customer_id: customerId, // Update customer_id if converted from lead
          ...(closedWonStageId && { stage_id: closedWonStageId }), // Set to Closed Won stage
        } as any)
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      // Link quote to contract in helpdesk_linked_documents
      await supabase.from('helpdesk_linked_documents').insert({
        tenant_id: profile.tenant_id,
        ticket_id: (contract as any).id,
        document_id: quote.id,
        document_type: 'quote',
        document_number: quote.quote_number,
        created_by: user.id,
      });

      // Add audit log for conversion
      const userName = user.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
        : user.email?.split("@")[0] || "System";

      await supabase.from("audit_logs").insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        user_name: userName,
        table_name: "quotes",
        record_id: quote.id,
        action: "update",
        field_name: "converted_to_contract",
        old_value: null,
        new_value: (contract as any).id,
        note: `Quote converted to Service Contract: ${contractData.title} (${(contract as any).id})`,
      });

      // Create version snapshot
      const { data: existingVersions } = await supabase
        .from("quote_versions")
        .select("version_number")
        .eq("quote_id", quote.id)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion = existingVersions && existingVersions.length > 0 
        ? existingVersions[0].version_number + 1 
        : 1;

      await supabase.from("quote_versions").insert({
        quote_id: quote.id,
        version_number: nextVersion,
        title: quote.title,
        description: quote.description,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate || 0,
        tax_amount: quote.tax_amount,
        discount_amount: 0,
        total_amount: quote.total_amount,
        quote_type: 'conversion',
        line_items: lineItems,
        notes: quote.notes,
        terms_conditions: quote.terms_conditions,
        changed_by: user.id,
        change_description: `Snapshot before conversion to Service Contract: ${contractData.title}`,
      } as any);

      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quote.id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Quote converted to service contract successfully' });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error converting quote',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleConvert = () => {
    if (conversionType === 'project') {
      convertToProjectMutation.mutate();
    } else if (conversionType === 'service_order') {
      convertToServiceOrderMutation.mutate();
    } else if (conversionType === 'contract') {
      convertToContractMutation.mutate();
    }
  };

  const updateContractLineItem = (index: number, field: string, value: any) => {
    const updated = [...contractLineItems];
    updated[index] = { ...updated[index], [field]: value };
    setContractLineItems(updated);
  };

  const isLoading = convertToProjectMutation.isPending || 
                    convertToServiceOrderMutation.isPending || 
                    convertToContractMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert Quote</DialogTitle>
            <DialogDescription>
              Convert this quote into a project, service order, or service contract
            </DialogDescription>
          </DialogHeader>

          {isConverted && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This quote has already been converted to a{' '}
                {quote?.converted_to_service_order_id && 'service order'}
                {quote?.converted_to_project_id && 'project'}
                {quote?.converted_to_contract_id && 'contract'}
                . Delete the linked document to convert again.
              </AlertDescription>
            </Alert>
          )}

          {hasLead && !createdCustomerId && (
            <Alert>
              <UserPlus className="h-4 w-4" />
              <AlertDescription>
                This quote is for a lead. You must convert the lead to a customer before creating a{' '}
                {conversionType === 'project' ? 'project' : conversionType === 'service_order' ? 'service order' : 'contract'}.
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={conversionType} onValueChange={(v: any) => setConversionType(v)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="project" disabled={isConverted}>
                <Briefcase className="mr-2 h-4 w-4" />
                Project
              </TabsTrigger>
              <TabsTrigger value="service_order" disabled={isConverted}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Service Order
              </TabsTrigger>
              <TabsTrigger value="contract" disabled={isConverted}>
                <FileCheck className="mr-2 h-4 w-4" />
                Service Contract
              </TabsTrigger>
            </TabsList>

          <TabsContent value="project" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name *</Label>
                <Input
                  id="project-name"
                  value={projectData.name}
                  onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                  placeholder="Enter project name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <RichTextEditor
                  value={projectData.description}
                  onChange={(value) => setProjectData({ ...projectData, description: value })}
                  placeholder="Enter project description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-start">Start Date *</Label>
                  <Input
                    id="project-start"
                    type="date"
                    value={projectData.start_date}
                    onChange={(e) => setProjectData({ ...projectData, start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-budget">Budget</Label>
                  <Input
                    id="project-budget"
                    type="number"
                    step="0.01"
                    value={projectData.budget}
                    onChange={(e) => setProjectData({ ...projectData, budget: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> A new project will be created with status "Planning". 
                  Quote line items will need to be manually added to project tasks if needed.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="service_order" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="so-title">Title *</Label>
                <Input
                  id="so-title"
                  value={serviceOrderData.title}
                  onChange={(e) => setServiceOrderData({ ...serviceOrderData, title: e.target.value })}
                  placeholder="Enter service order title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="so-description">Description</Label>
                <RichTextEditor
                  value={serviceOrderData.description}
                  onChange={(value) => setServiceOrderData({ ...serviceOrderData, description: value })}
                  placeholder="Enter description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="so-date">Preferred Date *</Label>
                  <Input
                    id="so-date"
                    type="date"
                    value={serviceOrderData.preferred_date}
                    onChange={(e) => setServiceOrderData({ ...serviceOrderData, preferred_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="so-date-start">Date Range Start</Label>
                  <Input
                    id="so-date-start"
                    type="date"
                    value={serviceOrderData.preferred_date_start}
                    onChange={(e) => setServiceOrderData({ ...serviceOrderData, preferred_date_start: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="so-date-end">Date Range End</Label>
                  <Input
                    id="so-date-end"
                    type="date"
                    value={serviceOrderData.preferred_date_end}
                    onChange={(e) => setServiceOrderData({ ...serviceOrderData, preferred_date_end: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="so-amount">Fixed Amount</Label>
                  <Input
                    id="so-amount"
                    type="number"
                    step="0.01"
                    value={serviceOrderData.fixed_amount}
                    onChange={(e) => setServiceOrderData({ ...serviceOrderData, fixed_amount: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> A new service order will be created with status "Waiting". 
                  You can assign workers and update details after creation.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contract" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contract-title">Contract Title *</Label>
                <Input
                  id="contract-title"
                  value={contractData.title}
                  onChange={(e) => setContractData({ ...contractData, title: e.target.value })}
                  placeholder="Enter contract title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-description">Description</Label>
                <RichTextEditor
                  value={contractData.description}
                  onChange={(value) => setContractData({ ...contractData, description: value })}
                  placeholder="Enter description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contract-start">Start Date *</Label>
                  <Input
                    id="contract-start"
                    type="date"
                    value={contractData.start_date}
                    onChange={(e) => setContractData({ ...contractData, start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract-end">End Date</Label>
                  <Input
                    id="contract-end"
                    type="date"
                    value={contractData.end_date}
                    onChange={(e) => setContractData({ ...contractData, end_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract-billing">Billing Frequency</Label>
                  <Select
                    value={contractData.billing_frequency}
                    onValueChange={(value) => setContractData({ ...contractData, billing_frequency: value })}
                  >
                    <SelectTrigger id="contract-billing">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Line Item Schedules</Label>
                  <Badge variant="secondary">
                    {contractLineItems.length} items
                  </Badge>
                </div>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {contractLineItems.map((item, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">{item.description}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              disabled
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Price</Label>
                            <Input
                              type="number"
                              value={item.unit_price}
                              disabled
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Total</Label>
                            <Input
                              type="number"
                              value={item.line_total}
                              disabled
                              className="h-8"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor={`freq-${index}`} className="text-xs">Recurrence Frequency *</Label>
                            <Select
                              value={item.recurrence_frequency}
                              onValueChange={(value) => updateContractLineItem(index, 'recurrence_frequency', value)}
                            >
                              <SelectTrigger id={`freq-${index}`} className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {frequencyOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor={`gen-date-${index}`} className="text-xs">First Generation Date *</Label>
                            <Input
                              id={`gen-date-${index}`}
                              type="date"
                              value={item.first_generation_date}
                              onChange={(e) => updateContractLineItem(index, 'first_generation_date', e.target.value)}
                              className="h-8"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Service orders will be automatically generated based on the recurrence schedules. 
                  Each line item can have its own frequency and start date.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={initiateConversion} disabled={isLoading || isConverted}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {hasLead && !createdCustomerId ? (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Convert Lead to Customer
              </>
            ) : (
              <>Convert to {conversionType === 'project' ? 'Project' : conversionType === 'service_order' ? 'Service Order' : 'Contract'}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <CustomerDialog
      open={customerDialogOpen}
      onOpenChange={setCustomerDialogOpen}
      leadId={quote?.lead_id}
      leadData={leadData}
      onCustomerCreated={(customerId) => {
        setCreatedCustomerId(customerId);
        setCustomerDialogOpen(false);
      }}
    />
    </>
  );
}
