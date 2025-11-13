import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitCompare, TrendingUp, TrendingDown, Minus, Plus, X, Edit } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface QuoteVersionComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentQuote: any;
  currentLineItems: any[];
  versionSnapshot: any;
}

interface DiffItem {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
}

export default function QuoteVersionComparisonDialog({
  open,
  onOpenChange,
  currentQuote,
  currentLineItems,
  versionSnapshot,
}: QuoteVersionComparisonDialogProps) {
  const versionLineItems = versionSnapshot.line_items || [];

  const calculateDifference = (current: number, previous: number) => {
    const diff = current - previous;
    const percentChange = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : "N/A";
    return { diff, percentChange };
  };

  const getDifferenceIcon = (diff: number) => {
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (diff < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  // Generate field-by-field diff
  const generateFieldDiff = (): DiffItem[] => {
    const diffs: DiffItem[] = [];
    
    const fields = [
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description' },
      { key: 'subtotal', label: 'Subtotal', format: (v: number) => `$${Number(v).toFixed(2)}` },
      { key: 'tax_rate', label: 'Tax Rate', format: (v: number) => `${Number(v)}%` },
      { key: 'tax_amount', label: 'Tax Amount', format: (v: number) => `$${Number(v).toFixed(2)}` },
      { key: 'total_amount', label: 'Total Amount', format: (v: number) => `$${Number(v).toFixed(2)}` },
      { key: 'notes', label: 'Notes' },
      { key: 'terms_conditions', label: 'Terms & Conditions' },
    ];

    fields.forEach(field => {
      const oldVal = versionSnapshot[field.key];
      const newVal = currentQuote[field.key];
      
      let changeType: DiffItem['changeType'] = 'unchanged';
      if (oldVal !== newVal) {
        if (oldVal == null || oldVal === '') changeType = 'added';
        else if (newVal == null || newVal === '') changeType = 'removed';
        else changeType = 'modified';
      }

      diffs.push({
        field: field.key,
        label: field.label,
        oldValue: field.format ? field.format(oldVal) : oldVal,
        newValue: field.format ? field.format(newVal) : newVal,
        changeType,
      });
    });

    return diffs;
  };

  const fieldDiffs = generateFieldDiff();
  const hasChanges = fieldDiffs.some(d => d.changeType !== 'unchanged');

  const subtotalDiff = calculateDifference(
    currentQuote.subtotal,
    versionSnapshot.subtotal
  );
  const taxDiff = calculateDifference(
    currentQuote.tax_amount,
    versionSnapshot.tax_amount
  );
  const totalDiff = calculateDifference(
    currentQuote.total_amount,
    versionSnapshot.total_amount
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Compare Quote Versions
          </DialogTitle>
          <DialogDescription>
            Comparing current version with Version {versionSnapshot.version_number} from {new Date(versionSnapshot.created_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="diff">Detailed Diff</TabsTrigger>
            <TabsTrigger value="line-items">Line Items</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-4 text-muted-foreground">
                      Version {versionSnapshot.version_number}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">${Number(versionSnapshot.subtotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span className="font-medium">${Number(versionSnapshot.tax_amount).toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span>${Number(versionSnapshot.total_amount).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-4 text-primary">Current Version</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>Subtotal:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${Number(currentQuote.subtotal).toFixed(2)}</span>
                          {subtotalDiff.diff !== 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              {getDifferenceIcon(subtotalDiff.diff)}
                              ${Math.abs(subtotalDiff.diff).toFixed(2)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Tax:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${Number(currentQuote.tax_amount).toFixed(2)}</span>
                          {taxDiff.diff !== 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              {getDifferenceIcon(taxDiff.diff)}
                              ${Math.abs(taxDiff.diff).toFixed(2)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center font-semibold">
                        <span>Total:</span>
                        <div className="flex items-center gap-2">
                          <span>${Number(currentQuote.total_amount).toFixed(2)}</span>
                          {totalDiff.diff !== 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              {getDifferenceIcon(totalDiff.diff)}
                              ${Math.abs(totalDiff.diff).toFixed(2)} ({totalDiff.percentChange}%)
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diff" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Field-by-Field Changes</CardTitle>
              </CardHeader>
              <CardContent>
                {!hasChanges ? (
                  <p className="text-sm text-muted-foreground">No changes detected.</p>
                ) : (
                  <div className="space-y-2">
                    {fieldDiffs.map((diff) => {
                      if (diff.changeType === 'unchanged') return null;

                      return (
                        <div
                          key={diff.field}
                          className={`rounded-lg border p-4 ${
                            diff.changeType === 'added' ? 'bg-success/5 border-success/20' :
                            diff.changeType === 'removed' ? 'bg-destructive/5 border-destructive/20' :
                            'bg-warning/5 border-warning/20'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {diff.changeType === 'added' && <Plus className="h-4 w-4 text-success mt-0.5" />}
                            {diff.changeType === 'removed' && <X className="h-4 w-4 text-destructive mt-0.5" />}
                            {diff.changeType === 'modified' && <Edit className="h-4 w-4 text-warning mt-0.5" />}
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{diff.label}</span>
                                <Badge variant="outline" className="text-xs">
                                  {diff.changeType === 'added' && 'Added'}
                                  {diff.changeType === 'removed' && 'Removed'}
                                  {diff.changeType === 'modified' && 'Modified'}
                                </Badge>
                              </div>

                              {diff.changeType === 'removed' && (
                                <div className="bg-destructive/10 border-l-4 border-destructive px-3 py-2 rounded">
                                  <span className="text-sm text-muted-foreground line-through">
                                    {diff.oldValue || '(empty)'}
                                  </span>
                                </div>
                              )}

                              {diff.changeType === 'added' && (
                                <div className="bg-success/10 border-l-4 border-success px-3 py-2 rounded">
                                  <span className="text-sm font-medium">
                                    {diff.newValue || '(empty)'}
                                  </span>
                                </div>
                              )}

                              {diff.changeType === 'modified' && (
                                <>
                                  <div className="bg-destructive/10 border-l-4 border-destructive px-3 py-2 rounded">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                      Before (v{versionSnapshot.version_number})
                                    </span>
                                    <p className="text-sm text-muted-foreground line-through mt-1">
                                      {diff.oldValue || '(empty)'}
                                    </p>
                                  </div>
                                  <div className="bg-success/10 border-l-4 border-success px-3 py-2 rounded">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                      After (Current)
                                    </span>
                                    <p className="text-sm font-medium mt-1">
                                      {diff.newValue || '(empty)'}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="line-items" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Line Items Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2 text-muted-foreground">
                      Version {versionSnapshot.version_number} Line Items
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {versionLineItems.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
                            <TableCell className="text-right">${Number(item.line_total).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-2 text-primary">Current Line Items</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentLineItems.map((item: any, index: number) => {
                          const versionItem = versionLineItems.find((v: any) => v.description === item.description);
                          const hasChanged = versionItem && (
                            versionItem.quantity !== item.quantity ||
                            versionItem.unit_price !== item.unit_price ||
                            versionItem.line_total !== item.line_total
                          );

                          return (
                            <TableRow key={item.id || index} className={hasChanged ? "bg-accent/10" : ""}>
                              <TableCell>{item.description}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
                              <TableCell className="text-right">${Number(item.line_total).toFixed(2)}</TableCell>
                              <TableCell className="text-right">
                                {versionItem ? (
                                  hasChanged ? (
                                    <Badge variant="outline" className="text-warning">Modified</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">Unchanged</Badge>
                                  )
                                ) : (
                                  <Badge variant="outline" className="text-success">New</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
