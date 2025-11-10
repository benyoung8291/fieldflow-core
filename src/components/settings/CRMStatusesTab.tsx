import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface CRMStatus {
  id: string;
  status: string;
  display_name: string;
  probability_percentage: number;
  color: string;
  display_order: number;
  is_active: boolean;
  pipeline_id: string | null;
}

export default function CRMStatusesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
  const [isPipelineDialogOpen, setIsPipelineDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CRMStatus | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [selectedPipelineForStage, setSelectedPipelineForStage] = useState<string>('');
  const [openPipelines, setOpenPipelines] = useState<Set<string>>(new Set());
  
  const [pipelineFormData, setPipelineFormData] = useState({
    name: '',
    description: '',
    is_default: false,
  });
  
  const [stageFormData, setStageFormData] = useState({
    status: '',
    display_name: '',
    probability_percentage: '50',
    color: '#0891B2',
    display_order: '0',
    pipeline_id: '',
  });

  // Fetch pipelines
  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_pipelines' as any)
        .select('*')
        .order('name');
      
      if (error) throw error;
      return (data || []) as unknown as Pipeline[];
    },
  });

  // Fetch all stages
  const { data: allStatuses = [] } = useQuery({
    queryKey: ['crm-statuses-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_status_settings')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data as CRMStatus[];
    },
  });

  const getStagesForPipeline = (pipelineId: string) => {
    return allStatuses.filter(status => status.pipeline_id === pipelineId);
  };

  const togglePipeline = (pipelineId: string) => {
    const newOpen = new Set(openPipelines);
    if (newOpen.has(pipelineId)) {
      newOpen.delete(pipelineId);
    } else {
      newOpen.add(pipelineId);
    }
    setOpenPipelines(newOpen);
  };

  // Pipeline mutations
  const createPipeline = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) throw new Error('No tenant found');

      const { error } = await supabase.from('crm_pipelines' as any).insert({
        tenant_id: profile.tenant_id,
        ...data,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
      toast({ title: 'Pipeline created successfully' });
      handlePipelineDialogClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating pipeline',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updatePipeline = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('crm_pipelines' as any)
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
      toast({ title: 'Pipeline updated successfully' });
      handlePipelineDialogClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating pipeline',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deletePipeline = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_pipelines' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
      toast({ title: 'Pipeline deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting pipeline',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Stage mutations
  const createStage = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) throw new Error('No tenant found');

      const { error } = await supabase.from('crm_status_settings').insert({
        tenant_id: profile.tenant_id,
        ...data,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-statuses-settings'] });
      toast({ title: 'Stage created successfully' });
      handleStageDialogClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating stage',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('crm_status_settings')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-statuses-settings'] });
      toast({ title: 'Stage updated successfully' });
      handleStageDialogClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating stage',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_status_settings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-statuses-settings'] });
      toast({ title: 'Stage deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting stage',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handlePipelineDialogClose = () => {
    setIsPipelineDialogOpen(false);
    setSelectedPipeline(null);
    setPipelineFormData({
      name: '',
      description: '',
      is_default: false,
    });
  };

  const handleStageDialogClose = () => {
    setIsStageDialogOpen(false);
    setSelectedStatus(null);
    setStageFormData({
      status: '',
      display_name: '',
      probability_percentage: '50',
      color: '#0891B2',
      display_order: '0',
      pipeline_id: '',
    });
  };

  const handleEditPipeline = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setPipelineFormData({
      name: pipeline.name,
      description: pipeline.description || '',
      is_default: pipeline.is_default,
    });
    setIsPipelineDialogOpen(true);
  };

  const handleEditStage = (status: CRMStatus) => {
    setSelectedStatus(status);
    setStageFormData({
      status: status.status,
      display_name: status.display_name,
      probability_percentage: status.probability_percentage.toString(),
      color: status.color,
      display_order: status.display_order.toString(),
      pipeline_id: status.pipeline_id || '',
    });
    setIsStageDialogOpen(true);
  };

  const handleAddStageForPipeline = (pipelineId: string) => {
    setSelectedPipelineForStage(pipelineId);
    setStageFormData({
      ...stageFormData,
      pipeline_id: pipelineId,
    });
    setIsStageDialogOpen(true);
  };

  const handleSubmitPipeline = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      name: pipelineFormData.name,
      description: pipelineFormData.description || null,
      is_default: pipelineFormData.is_default,
    };

    if (selectedPipeline) {
      updatePipeline.mutate({ id: selectedPipeline.id, data });
    } else {
      createPipeline.mutate(data);
    }
  };

  const handleSubmitStage = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      status: stageFormData.status,
      display_name: stageFormData.display_name,
      probability_percentage: parseFloat(stageFormData.probability_percentage),
      color: stageFormData.color,
      display_order: parseInt(stageFormData.display_order),
      pipeline_id: stageFormData.pipeline_id,
    };

    if (selectedStatus) {
      updateStage.mutate({ id: selectedStatus.id, data });
    } else {
      createStage.mutate(data);
    }
  };

  const handleToggleActive = async (pipeline: Pipeline) => {
    const { error } = await supabase
      .from('crm_pipelines' as any)
      .update({ is_active: !pipeline.is_active })
      .eq('id', pipeline.id);

    if (error) {
      toast({
        title: 'Error updating pipeline',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['crm-pipelines'] });
      toast({ title: 'Pipeline status updated' });
    }
  };

  const handleToggleStageActive = async (status: CRMStatus) => {
    const { error } = await supabase
      .from('crm_status_settings')
      .update({ is_active: !status.is_active })
      .eq('id', status.id);

    if (error) {
      toast({
        title: 'Error updating stage',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['crm-statuses-settings'] });
      toast({ title: 'Stage status updated' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">CRM Pipelines & Stages</h3>
          <p className="text-sm text-muted-foreground">
            Manage sales pipelines and their stages
          </p>
        </div>
        <Button onClick={() => setIsPipelineDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Pipeline
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : pipelines.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No pipelines yet. Create your first pipeline to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((pipeline) => {
            const stages = getStagesForPipeline(pipeline.id);
            const isOpen = openPipelines.has(pipeline.id);

            return (
              <Card key={pipeline.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => togglePipeline(pipeline.id)}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {pipeline.name}
                          {pipeline.is_default && (
                            <Badge variant="default" className="text-xs">Default</Badge>
                          )}
                        </CardTitle>
                        {pipeline.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {pipeline.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{stages.length} stages</Badge>
                      <Switch
                        checked={pipeline.is_active}
                        onCheckedChange={() => handleToggleActive(pipeline)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddStageForPipeline(pipeline.id)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Stage
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPipeline(pipeline)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this pipeline? All associated stages will also be deleted.')) {
                            deletePipeline.mutate(pipeline.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isOpen && stages.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="space-y-2 pl-11">
                      {stages.map((stage) => (
                        <div
                          key={stage.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            <div>
                              <p className="font-medium">{stage.display_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {stage.status} • {stage.probability_percentage}% probability • Order: {stage.display_order}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {stage.is_active ? (
                              <Badge variant="default" className="text-xs">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                            <Switch
                              checked={stage.is_active}
                              onCheckedChange={() => handleToggleStageActive(stage)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditStage(stage)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this stage?')) {
                                  deleteStage.mutate(stage.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}

                {isOpen && stages.length === 0 && (
                  <CardContent className="pt-0">
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      No stages yet. Add a stage to this pipeline.
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pipeline Dialog */}
      <Dialog open={isPipelineDialogOpen} onOpenChange={setIsPipelineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPipeline ? 'Edit Pipeline' : 'Add Pipeline'}
            </DialogTitle>
            <DialogDescription>
              Configure a sales pipeline with multiple stages
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitPipeline} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pipeline-name">Name *</Label>
              <Input
                id="pipeline-name"
                value={pipelineFormData.name}
                onChange={(e) => setPipelineFormData({ ...pipelineFormData, name: e.target.value })}
                placeholder="e.g., Sales Pipeline"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pipeline-description">Description</Label>
              <Textarea
                id="pipeline-description"
                value={pipelineFormData.description}
                onChange={(e) => setPipelineFormData({ ...pipelineFormData, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="pipeline-default"
                checked={pipelineFormData.is_default}
                onCheckedChange={(checked) => setPipelineFormData({ ...pipelineFormData, is_default: checked })}
              />
              <Label htmlFor="pipeline-default" className="cursor-pointer">
                Set as default pipeline
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handlePipelineDialogClose}>
                Cancel
              </Button>
              <Button type="submit">
                {selectedPipeline ? 'Update' : 'Create'} Pipeline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stage Dialog */}
      <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedStatus ? 'Edit Stage' : 'Add Stage'}
            </DialogTitle>
            <DialogDescription>
              Configure a pipeline stage
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitStage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stage-display-name">Display Name *</Label>
              <Input
                id="stage-display-name"
                value={stageFormData.display_name}
                onChange={(e) => setStageFormData({ ...stageFormData, display_name: e.target.value })}
                placeholder="e.g., Qualified Lead"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage-status">Status Key *</Label>
              <Input
                id="stage-status"
                value={stageFormData.status}
                onChange={(e) => setStageFormData({ ...stageFormData, status: e.target.value })}
                placeholder="e.g., qualified"
                required
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier used in code (lowercase, no spaces)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stage-probability">Probability %</Label>
                <Input
                  id="stage-probability"
                  type="number"
                  min="0"
                  max="100"
                  value={stageFormData.probability_percentage}
                  onChange={(e) => setStageFormData({ ...stageFormData, probability_percentage: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stage-order">Display Order</Label>
                <Input
                  id="stage-order"
                  type="number"
                  value={stageFormData.display_order}
                  onChange={(e) => setStageFormData({ ...stageFormData, display_order: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage-color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="stage-color"
                  type="color"
                  value={stageFormData.color}
                  onChange={(e) => setStageFormData({ ...stageFormData, color: e.target.value })}
                  className="w-20"
                />
                <Input
                  type="text"
                  value={stageFormData.color}
                  onChange={(e) => setStageFormData({ ...stageFormData, color: e.target.value })}
                  placeholder="#0891B2"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleStageDialogClose}>
                Cancel
              </Button>
              <Button type="submit">
                {selectedStatus ? 'Update' : 'Create'} Stage
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
