import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PasswordChangeSection from './PasswordChangeSection';
import { EmailSignatureEditor } from './EmailSignatureEditor';

interface Pipeline {
  id: string;
  name: string;
  is_active: boolean;
}

interface Stage {
  id: string;
  display_name: string;
  pipeline_id: string;
  is_active: boolean;
}

export default function UserProfileTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [taskKanbanMode, setTaskKanbanMode] = useState<string>('business_days');

  // Fetch current user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('default_pipeline_id, default_stage_id, task_kanban_mode')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch pipelines
  const { data: pipelines = [] } = useQuery({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_pipelines' as any)
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return (data || []) as unknown as Pipeline[];
    },
  });

  // Fetch stages for selected pipeline
  const { data: stages = [] } = useQuery({
    queryKey: ['crm-stages', selectedPipelineId],
    queryFn: async () => {
      if (!selectedPipelineId) return [];

      const { data, error } = await supabase
        .from('crm_status_settings')
        .select('*')
        .eq('pipeline_id', selectedPipelineId)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as Stage[];
    },
    enabled: !!selectedPipelineId,
  });

  // Initialize form with current profile values
  useEffect(() => {
    if (profile) {
      if (profile.default_pipeline_id) {
        setSelectedPipelineId(profile.default_pipeline_id);
      }
      if (profile.default_stage_id) {
        setSelectedStageId(profile.default_stage_id);
      }
      if (profile.task_kanban_mode) {
        setTaskKanbanMode(profile.task_kanban_mode);
      }
    }
  }, [profile]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          default_pipeline_id: selectedPipelineId || null,
          default_stage_id: selectedStageId || null,
          task_kanban_mode: taskKanbanMode,
        })
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast({ title: 'Profile updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating profile',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate();
  };

  if (profileLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CRM Defaults</CardTitle>
          <CardDescription>
            Set your default pipeline and stage for new quotes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-pipeline">Default Pipeline</Label>
            <Select
              value={selectedPipelineId}
              onValueChange={(value) => {
                setSelectedPipelineId(value);
                setSelectedStageId(''); // Reset stage when pipeline changes
              }}
            >
              <SelectTrigger id="default-pipeline">
                <SelectValue placeholder="Select a pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-stage">Default Stage</Label>
            <Select
              value={selectedStageId}
              onValueChange={setSelectedStageId}
              disabled={!selectedPipelineId || stages.length === 0}
            >
              <SelectTrigger id="default-stage">
                <SelectValue placeholder="Select a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Kanban View</CardTitle>
          <CardDescription>
            Configure how the 3-day kanban view displays tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-kanban-mode">Kanban Display Mode</Label>
            <Select
              value={taskKanbanMode}
              onValueChange={setTaskKanbanMode}
            >
              <SelectTrigger id="task-kanban-mode">
                <SelectValue placeholder="Select a mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="business_days">
                  Business Days Only (Mon-Fri, includes weekends with tasks)
                </SelectItem>
                <SelectItem value="consecutive_days">
                  Consecutive Days (Always show today, tomorrow, day after)
                </SelectItem>
                <SelectItem value="include_weekends">
                  Include Weekends (Always show next 3 calendar days)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              This setting controls which 3 days are shown in the task kanban view
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <EmailSignatureEditor />

      <PasswordChangeSection />
    </div>
  );
}
