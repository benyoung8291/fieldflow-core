import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface CRMPipeline {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
}

export default function CRMPipelinesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<CRMPipeline | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_default: false,
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
      return data as unknown as CRMPipeline[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
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
      handleDialogClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating pipeline',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
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
      handleDialogClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating pipeline',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
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

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedPipeline(null);
    setFormData({
      name: '',
      description: '',
      is_default: false,
    });
  };

  const handleEdit = (pipeline: CRMPipeline) => {
    setSelectedPipeline(pipeline);
    setFormData({
      name: pipeline.name,
      description: pipeline.description || '',
      is_default: pipeline.is_default,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      name: formData.name,
      description: formData.description || null,
      is_default: formData.is_default,
    };

    if (selectedPipeline) {
      updateMutation.mutate({ id: selectedPipeline.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this pipeline? All associated stages will also be deleted.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleActive = async (pipeline: CRMPipeline) => {
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">CRM Pipelines</h3>
          <p className="text-sm text-muted-foreground">
            Manage sales pipelines for your quotes and leads
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pipelines.map((pipeline) => (
              <TableRow key={pipeline.id}>
                <TableCell className="font-medium">{pipeline.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {pipeline.description || '-'}
                </TableCell>
                <TableCell>
                  {pipeline.is_default && (
                    <Badge variant="default">Default</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={pipeline.is_active}
                    onCheckedChange={() => handleToggleActive(pipeline)}
                  />
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(pipeline)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(pipeline.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPipeline ? 'Edit Pipeline' : 'Add Pipeline'}
            </DialogTitle>
            <DialogDescription>
              Configure a sales pipeline with multiple stages
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Sales Pipeline"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
              <Label htmlFor="is_default" className="cursor-pointer">
                Set as default pipeline
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button type="submit">
                {selectedPipeline ? 'Update' : 'Create'} Pipeline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}