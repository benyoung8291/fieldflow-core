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
import { DollarSign, User, Calendar, ExternalLink, Settings } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
      
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(name),
          lead:leads(name),
          quote_owner:profiles!quote_owner(first_name, last_name)
        `)
        .eq('pipeline_id', selectedPipelineId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as Quote[];
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

  const QuoteCard = ({ quote, isDragging = false }: { quote: Quote; isDragging?: boolean }) => {
    const customerName = quote.customer?.name || quote.lead?.name || 'Unknown';
    const ownerName = quote.quote_owner 
      ? `${quote.quote_owner.first_name || ''} ${quote.quote_owner.last_name || ''}`.trim() 
      : null;

    return (
      <Card 
        className={cn(
          "mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
          isDragging && "opacity-50"
        )}
      >
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{quote.title}</p>
              <p className="text-sm text-muted-foreground truncate">{customerName}</p>
            </div>
            <Badge variant="outline" className="ml-2 shrink-0">
              {quote.quote_number}
            </Badge>
          </div>

          <div className="flex items-center gap-1 text-lg font-bold text-primary">
            <DollarSign className="h-4 w-4" />
            {quote.total_amount?.toLocaleString()}
          </div>

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {ownerName && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {ownerName}
              </div>
            )}
            {quote.expected_close_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(quote.expected_close_date), 'MMM d, yyyy')}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Created {format(new Date(quote.created_at), 'MMM d')}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => window.open(`/quotes/${quote.id}`, '_blank')}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View Details
          </Button>
        </CardContent>
      </Card>
    );
  };

  const KanbanColumn = ({ status }: { status: CRMStatus }) => {
    const metrics = getColumnMetrics(status);
    const columnQuotes = quotesByStage[status.id] || [];

    return (
      <div className="flex flex-col h-full min-w-[300px]">
        <Card className="flex-shrink-0 mb-4" style={{ borderTopColor: status.color, borderTopWidth: 3 }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{status.display_name}</CardTitle>
              <Badge variant="secondary">{metrics.count}</Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold">${metrics.total.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Weighted ({status.probability_percentage}%):</span>
                <span className="font-bold" style={{ color: status.color }}>
                  ${metrics.weighted.toLocaleString()}
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div 
          className="flex-1 space-y-3 p-3 rounded-lg bg-muted/20 min-h-[400px] overflow-y-auto"
          id={status.id}
        >
          {columnQuotes.map(quote => (
            <div
              key={quote.id}
              draggable
              onDragStart={() => setActiveQuote(quote)}
            >
              <QuoteCard quote={quote} />
            </div>
          ))}
          {columnQuotes.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No quotes in this stage
            </div>
          )}
        </div>
      </div>
    );
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
            {crmStatuses.map(status => (
              <KanbanColumn key={status.id} status={status} />
            ))}
          </div>

          <DragOverlay>
            {activeQuote && <QuoteCard quote={activeQuote} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>
    </DashboardLayout>
  );
}
