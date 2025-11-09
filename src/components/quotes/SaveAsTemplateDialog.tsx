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
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface LineItem {
  description: string;
  quantity: string;
  cost_price?: string;
  margin_percentage?: string;
  sell_price?: string;
  line_total?: number;
  subItems?: LineItem[];
  price_book_item_id?: string;
  is_from_price_book?: boolean;
  notes?: string;
}

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItems: LineItem[];
  quoteType: string;
}

export default function SaveAsTemplateDialog({
  open,
  onOpenChange,
  lineItems,
  quoteType,
}: SaveAsTemplateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!formData.name.trim()) {
        throw new Error('Template name is required');
      }

      // Get user session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) throw new Error('No tenant found');

      // Create template
      const { data: template, error: templateError } = await supabase
        .from('quote_item_templates')
        .insert({
          tenant_id: profile.tenant_id,
          name: formData.name,
          description: formData.description,
          quote_type: quoteType,
          created_by: user.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Flatten line items with parent-child relationships
      const flattenedItems: any[] = [];
      let itemOrder = 0;

      const processItems = (items: LineItem[], parentId: string | null = null) => {
        items.forEach((item) => {
          const itemId = crypto.randomUUID();
          flattenedItems.push({
            template_id: template.id,
            description: item.description,
            quantity: parseFloat(item.quantity) || 1,
            cost_price: parseFloat(item.cost_price || '0'),
            margin_percentage: parseFloat(item.margin_percentage || '0'),
            sell_price: parseFloat(item.sell_price || '0'),
            parent_line_item_id: parentId,
            item_order: itemOrder++,
            price_book_item_id: item.price_book_item_id || null,
            is_from_price_book: item.is_from_price_book || false,
            notes: item.notes || null,
          });

          // Process sub-items
          if (item.subItems && item.subItems.length > 0) {
            processItems(item.subItems, itemId);
          }
        });
      };

      processItems(lineItems);

      // Save template lines
      if (flattenedItems.length > 0) {
        const { error: linesError } = await supabase
          .from('quote_item_template_lines')
          .insert(flattenedItems);

        if (linesError) throw linesError;
      }

      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-item-templates'] });
      toast({
        title: 'Template saved successfully',
        description: 'You can now use this template to create new quotes.',
      });
      setFormData({ name: '', description: '' });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving template',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTemplateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save current line items as a reusable template. This will include all {lineItems.length} line items
            {quoteType === 'complex' ? ' and their sub-items' : ''}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Standard Installation"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this template is for..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveTemplateMutation.isPending}>
              {saveTemplateMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
