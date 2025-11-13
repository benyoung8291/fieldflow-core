import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Loader2, Briefcase, ClipboardList, FileCheck } from 'lucide-react';
import { format } from 'date-fns';

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
}: ConvertQuoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [conversionType, setConversionType] = useState<'project' | 'service_order' | 'contract'>('project');

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
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
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

  // Convert to Project mutation
  const convertToProjectMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle();
      if (!profile?.tenant_id) throw new Error('No tenant found');

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: quote.customer_id,
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

      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ 
          converted_to_project_id: project.id,
          crm_status: 'won',
        } as any)
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

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

      // Generate order number
      const orderNumber = `SO-${Date.now()}`;

      // Create service order
      const { data: serviceOrder, error: soError } = await supabase
        .from('service_orders')
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: quote.customer_id,
          order_number: orderNumber,
          title: serviceOrderData.title,
          description: serviceOrderData.description,
          scheduled_date: serviceOrderData.scheduled_date,
          billing_type: serviceOrderData.billing_type,
          fixed_amount: serviceOrderData.fixed_amount,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (soError) throw soError;
      if (!serviceOrder) throw new Error('Failed to create service order');

      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ 
          converted_to_service_order_id: serviceOrder.id,
          crm_status: 'won',
        } as any)
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

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

      // Generate contract number
      const contractNumber = `SC-${Date.now()}`;

      // Calculate total contract value
      const totalValue = contractLineItems.reduce((sum, item) => sum + item.line_total, 0);

      // Create service contract
      const { data: contract, error: contractError } = await supabase
        .from('service_contracts' as any)
        .insert({
          tenant_id: profile.tenant_id,
          customer_id: quote.customer_id,
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

      // Update quote
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ 
          converted_to_contract_id: (contract as any).id,
          crm_status: 'won',
        } as any)
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Quote</DialogTitle>
          <DialogDescription>
            Convert this quote into a project, service order, or service contract
          </DialogDescription>
        </DialogHeader>

        <Tabs value={conversionType} onValueChange={(v: any) => setConversionType(v)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="project">
              <Briefcase className="mr-2 h-4 w-4" />
              Project
            </TabsTrigger>
            <TabsTrigger value="service_order">
              <ClipboardList className="mr-2 h-4 w-4" />
              Service Order
            </TabsTrigger>
            <TabsTrigger value="contract">
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
                <Textarea
                  id="project-description"
                  value={projectData.description}
                  onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                  placeholder="Enter project description"
                  rows={3}
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
                <Textarea
                  id="so-description"
                  value={serviceOrderData.description}
                  onChange={(e) => setServiceOrderData({ ...serviceOrderData, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="so-date">Scheduled Date *</Label>
                  <Input
                    id="so-date"
                    type="date"
                    value={serviceOrderData.scheduled_date}
                    onChange={(e) => setServiceOrderData({ ...serviceOrderData, scheduled_date: e.target.value })}
                  />
                </div>

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
                <Textarea
                  id="contract-description"
                  value={contractData.description}
                  onChange={(e) => setContractData({ ...contractData, description: e.target.value })}
                  placeholder="Enter description"
                  rows={2}
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
          <Button onClick={handleConvert} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Convert to {conversionType === 'project' ? 'Project' : conversionType === 'service_order' ? 'Service Order' : 'Contract'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
