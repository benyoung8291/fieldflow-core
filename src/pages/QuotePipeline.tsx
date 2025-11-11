import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { DollarSign, User, Calendar, ExternalLink, Settings, Eye } from 'lucide-react';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent, 
  PointerSensor, 
  TouchSensor,
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import QuoteQuickViewDialog from '@/components/quotes/QuoteQuickViewDialog';
import DraggableQuoteCard from '@/components/quotes/DraggableQuoteCard';
import DroppableQuoteColumn from '@/components/quotes/DroppableQuoteColumn';

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  total_amount: number;
  stage_id: string;
  pipeline_id: string;
  created_at: string;
  expected_close_date: string | null;
  customer?: { name: string };
  lead?: { name: string };
  quote_owner?: { first_name: string; last_name: string };
}

interface CRMStatus {
  id: string;
  status: string;
  display_name: string;
  probability_percentage: number;
  color: string;
  display_order: number;
  pipeline_id: string;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
}

export default function QuotePipeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [quickViewQuoteId, setQuickViewQuoteId] = useState<string | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  // Drag and drop sensors with mobile support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Fetch pipelines
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as unknown as Pipeline[];
    },
  });

  // Set default pipeline when pipelines load
  if (pipelines.length > 0 && !selectedPipelineId) {
    const defaultPipeline = pipelines.find(p => p.name === 'Sales Team') || pipelines[0];
    setSelectedPipelineId(defaultPipeline.id);
  }

  // Fetch CRM statuses filtered by pipeline
  const { data: crmStatuses = [] } = useQuery<CRMStatus[]>({
    queryKey: ['crm-statuses', selectedPipelineId],
    queryFn: async () => {
      if (!selectedPipelineId) return [];
      
      const { data, error } = await supabase
        .from('crm_status_settings' as any)
        .select('*')
        .eq('is_active', true)
        .eq('pipeline_id', selectedPipelineId)
        .order('display_order');
      
      if (error) throw error;
      return data as unknown as CRMStatus[];
    },
    enabled: !!selectedPipelineId,
  });

  // Fetch quotes filtered by pipeline
  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ['quotes-pipeline', selectedPipelineId],
    queryFn: async () => {
      if (!selectedPipelineId) return [];
      
      const { data: quotesData, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('pipeline_id', selectedPipelineId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!quotesData || quotesData.length === 0) return [];

      // Fetch related data separately
      const customerIds = quotesData.filter(q => q.customer_id).map(q => q.customer_id);
      const leadIds = quotesData.filter(q => q.lead_id).map(q => q.lead_id);
      const ownerIds = quotesData.filter(q => q.created_by).map(q => q.created_by);

      const [customersRes, leadsRes, ownersRes] = await Promise.all([
        customerIds.length > 0 
          ? supabase.from('customers').select('id, name').in('id', customerIds)
          : Promise.resolve({ data: [], error: null }),
        leadIds.length > 0
          ? supabase.from('leads').select('id, name').in('id', leadIds)
          : Promise.resolve({ data: [], error: null }),
        ownerIds.length > 0
          ? supabase.from('profiles').select('id, first_name, last_name').in('id', ownerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Map customers, leads, and owners to quotes
      const customersMap = new Map(
        (customersRes.data || []).map(c => [c.id, c] as [string, any])
      );
      const leadsMap = new Map(
        (leadsRes.data || []).map(l => [l.id, l] as [string, any])
      );
      const ownersMap = new Map(
        (ownersRes.data || []).map(o => [o.id, o] as [string, any])
      );

      return quotesData.map(quote => ({
        ...quote,
        customer: quote.customer_id ? customersMap.get(quote.customer_id) : null,
        lead: quote.lead_id ? leadsMap.get(quote.lead_id) : null,
        quote_owner: quote.created_by ? ownersMap.get(quote.created_by) : null,
      })) as unknown as Quote[];
    },
    enabled: !!selectedPipelineId,
  });

  // Update quote stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ quoteId, newStageId }: { quoteId: string; newStageId: string }) => {
      const { error } = await supabase
        .from('quotes')
        .update({ stage_id: newStageId } as any)
        .eq('id', quoteId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['quotes-analytics'] });
      toast({ title: 'Quote stage updated' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating stage',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Group quotes by stage
  const quotesByStage = crmStatuses.reduce((acc, status) => {
    acc[status.id] = quotes.filter(q => q.stage_id === status.id);
    return acc;
  }, {} as Record<string, Quote[]>);

  // Calculate weighted totals for each column
  const getColumnMetrics = (status: CRMStatus) => {
    const stageQuotes = quotesByStage[status.id] || [];
    const total = stageQuotes.reduce((sum, q) => sum + (q.total_amount || 0), 0);
    const probability = Number(status.probability_percentage) / 100;
    const weighted = total * probability;
    return { total, weighted, count: stageQuotes.length };
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const quote = quotes.find(q => q.id === event.active.id);
    setActiveQuote(quote || null);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const quoteId = active.id as string;
      const newStageId = over.id as string;
      
      updateStageMutation.mutate({ quoteId, newStageId });
    }
    
    setActiveQuote(null);
  };

  const handleQuickView = (quoteId: string) => {
    setQuickViewQuoteId(quoteId);
    setQuickViewOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading pipeline...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quote Pipeline</h1>
            <p className="text-muted-foreground">Drag quotes between stages to update their status</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedPipelineId || ''} onValueChange={setSelectedPipelineId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map(pipeline => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => window.location.href = '/settings'}>
              <Settings className="mr-2 h-4 w-4" />
              Configure Stages
            </Button>
          </div>
        </div>

        <DndContext 
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {crmStatuses.map(status => {
              const metrics = getColumnMetrics(status);
              const columnQuotes = quotesByStage[status.id] || [];
              
              return (
                <DroppableQuoteColumn
                  key={status.id}
                  id={status.id}
                  title={status.display_name}
                  color={status.color}
                  count={metrics.count}
                  totalAmount={metrics.total}
                  weightedAmount={metrics.weighted}
                  probabilityPercentage={status.probability_percentage}
                >
                  {columnQuotes.map(quote => (
                    <DraggableQuoteCard
                      key={quote.id}
                      quote={quote}
                      onQuickView={handleQuickView}
                    />
                  ))}
                  {columnQuotes.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No quotes in this stage
                    </div>
                  )}
                </DroppableQuoteColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeQuote && (
              <div className="opacity-80">
                <DraggableQuoteCard 
                  quote={activeQuote} 
                  onQuickView={handleQuickView}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <QuoteQuickViewDialog
        quoteId={quickViewQuoteId}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />
    </DashboardLayout>
  );
}
