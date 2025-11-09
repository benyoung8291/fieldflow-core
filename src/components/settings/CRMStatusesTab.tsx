import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface CRMStatus {
  id: string;
  status: string;
  display_name: string;
  probability_percentage: number;
  color: string;
  display_order: number;
  is_active: boolean;
}

export default function CRMStatusesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CRMStatus | null>(null);
  const [formData, setFormData] = useState({
    status: '',
    display_name: '',
    probability_percentage: '50',
    color: '#0891B2',
    display_order: '0',
  });

  // Fetch statuses
  const { data: statuses = [], isLoading } = useQuery({
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

      const { error } = await supabase.from('crm_status_settings').insert({
        tenant_id: profile.tenant_id,
        ...data,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-statuses-settings'] });
      queryClient.invalidateQueries({ queryKey: ['crm-statuses'] });
      toast({ title: 'CRM status created successfully' });
      handleDialogClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('crm_status_settings')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-statuses-settings'] });
      queryClient.invalidateQueries({ queryKey: ['crm-statuses'] });
      toast({ title: 'CRM status updated successfully' });
      handleDialogClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_status_settings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-statuses-settings'] });
      queryClient.invalidateQueries({ queryKey: ['crm-statuses'] });
      toast({ title: 'CRM status deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedStatus(null);
    setFormData({
      status: '',
      display_name: '',
      probability_percentage: '50',
      color: '#0891B2',
      display_order: '0',
    });
  };

  const handleEdit = (status: CRMStatus) => {
    setSelectedStatus(status);
    setFormData({
      status: status.status,
      display_name: status.display_name,
      probability_percentage: status.probability_percentage.toString(),
      color: status.color,
      display_order: status.display_order.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      status: formData.status,
      display_name: formData.display_name,
      probability_percentage: parseFloat(formData.probability_percentage),
      color: formData.color,
      display_order: parseInt(formData.display_order),
    };

    if (selectedStatus) {
      updateMutation.mutate({ id: selectedStatus.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this CRM status?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">CRM Pipeline Stages</h3>
          <p className="text-sm text-muted-foreground">
            Configure your sales pipeline stages and probability ratings
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Stage
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display Name</TableHead>
              <TableHead>Status Key</TableHead>
              <TableHead>Probability %</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.map((status) => (
              <TableRow key={status.id}>
                <TableCell className="font-medium">{status.display_name}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{status.status}</code>
                </TableCell>
                <TableCell>{status.probability_percentage}%</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-xs text-muted-foreground">{status.color}</span>
                  </div>
                </TableCell>
                <TableCell>{status.display_order}</TableCell>
                <TableCell>
                  <Badge variant={status.is_active ? 'default' : 'secondary'}>
                    {status.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(status)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(status.id)}
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
              {selectedStatus ? 'Edit CRM Stage' : 'Add CRM Stage'}
            </DialogTitle>
            <DialogDescription>
              Configure pipeline stage settings and probability ratings
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status Key *</Label>
              <Input
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                placeholder="e.g., qualified"
                required
                disabled={!!selectedStatus}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase, no spaces (used in code)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name *</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="e.g., Qualified Lead"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="probability">Probability % *</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                value={formData.probability_percentage}
                onChange={(e) => setFormData({ ...formData, probability_percentage: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Used for weighted pipeline calculations
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color *</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#0891B2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order *</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleDialogClose}>
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
