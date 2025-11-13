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
import { GitCompare, TrendingUp, TrendingDown, Minus } from "lucide-react";
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

        <div className="space-y-6">
          {/* Summary Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Summary Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {/* Version Column */}
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
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span className="font-medium">${Number(versionSnapshot.discount_amount).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span>${Number(versionSnapshot.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Current Column */}
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
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span className="font-medium">${Number(currentQuote.discount_amount).toFixed(2)}</span>
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

          {/* Line Items Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Version Line Items */}
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
                          <TableCell className="text-right">
                            ${Number(item.unit_price).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            ${Number(item.line_total).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator />

                {/* Current Line Items */}
                <div>
                  <h3 className="font-semibold mb-2 text-primary">
                    Current Line Items
                  </h3>
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
                        const versionItem = versionLineItems.find(
                          (v: any) => v.description === item.description
                        );
                        const hasChanged = versionItem && (
                          versionItem.quantity !== item.quantity ||
                          versionItem.unit_price !== item.unit_price ||
                          versionItem.line_total !== item.line_total
                        );

                        return (
                          <TableRow key={item.id || index} className={hasChanged ? "bg-accent/10" : ""}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              ${Number(item.unit_price).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${Number(item.line_total).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {versionItem ? (
                                hasChanged ? (
                                  <Badge variant="outline" className="text-warning">
                                    Modified
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    Unchanged
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="text-success">
                                  New
                                </Badge>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
