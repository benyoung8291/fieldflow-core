import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ProjectFinanceTabProps {
  projectId: string;
}

export default function ProjectFinanceTab({ projectId }: ProjectFinanceTabProps) {
  const { data: lineItems, isLoading } = useQuery({
    queryKey: ["project-line-items", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_line_items")
        .select("*")
        .eq("project_id", projectId)
        .order("item_order", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const topLevelItems = lineItems?.filter(item => !item.parent_line_item_id) || [];
  
  const getChildItems = (parentId: string) => {
    return lineItems?.filter(item => item.parent_line_item_id === parentId) || [];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Loading finance data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!lineItems || lineItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No line items yet. Line items will be imported when a quote is converted to a project.</p>
        </CardContent>
      </Card>
    );
  }

  const totalCost = lineItems.reduce((sum, item) => sum + (Number(item.cost_price) * Number(item.quantity)), 0);
  const totalRevenue = lineItems.reduce((sum, item) => sum + Number(item.line_total), 0);
  const totalMargin = totalRevenue - totalCost;
  const marginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMargin)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Margin %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marginPercentage.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Original Budget Line Items</CardTitle>
            <Badge variant="secondary">Locked</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            These line items represent the original project budget and cannot be edited. Use change orders to adjust the budget.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLevelItems.map((item) => {
                const children = getChildItems(item.id);
                return (
                  <>
                    <TableRow key={item.id} className="font-medium">
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(item.cost_price))}</TableCell>
                      <TableCell className="text-right">{item.margin_percentage}%</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(Number(item.line_total))}</TableCell>
                    </TableRow>
                    {children.map((child) => (
                      <TableRow key={child.id} className="text-sm">
                        <TableCell className="pl-8">{child.description}</TableCell>
                        <TableCell className="text-right">{child.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(child.unit_price))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(child.cost_price))}</TableCell>
                        <TableCell className="text-right">{child.margin_percentage}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(child.line_total))}</TableCell>
                      </TableRow>
                    ))}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
