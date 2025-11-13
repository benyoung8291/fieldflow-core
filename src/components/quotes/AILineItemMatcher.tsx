import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface AILineItemMatcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemsMatched: (items: any[]) => void;
  tenantId: string;
}

export default function AILineItemMatcher({
  open,
  onOpenChange,
  onItemsMatched,
  tenantId,
}: AILineItemMatcherProps) {
  const { toast } = useToast();
  const [lineItemsText, setLineItemsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [matchedItems, setMatchedItems] = useState<any[]>([]);

  const handleMatch = async () => {
    if (!lineItemsText.trim()) {
      toast({
        title: "Please enter line items",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('match-quote-items', {
        body: { lineItemsText }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setMatchedItems(data.items || []);
      toast({
        title: "Line items matched successfully",
        description: `Matched ${data.items?.length || 0} items from your pricebook and history`,
      });
    } catch (error: any) {
      console.error('Error matching items:', error);
      toast({
        title: "Error matching line items",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (matchedItems.length > 0) {
      onItemsMatched(matchedItems);
      onOpenChange(false);
      setLineItemsText("");
      setMatchedItems([]);
    }
  };

  const confidenceColors: Record<string, string> = {
    high: "bg-green-500/10 text-green-500 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    low: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Line Item Matcher
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>
              Paste Line Items
              <span className="text-xs text-muted-foreground ml-2">
                (e.g., from a builder's quote or spreadsheet)
              </span>
            </Label>
            <Textarea
              value={lineItemsText}
              onChange={(e) => setLineItemsText(e.target.value)}
              placeholder="Paste your line items here...&#10;&#10;Example:&#10;100m Cable - $500&#10;20x Junction boxes - $150&#10;Labor 8hrs - $800"
              rows={10}
              className="mt-2 font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleMatch}
              disabled={loading || !lineItemsText.trim()}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Matching...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Match Items with AI
                </>
              )}
            </Button>
            {matchedItems.length > 0 && (
              <Button onClick={handleApply} variant="default">
                <Upload className="mr-2 h-4 w-4" />
                Apply {matchedItems.length} Items
              </Button>
            )}
          </div>

          {matchedItems.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="font-semibold">Matched Items</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {matchedItems.map((item, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-3 space-y-2 bg-background"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.notes}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className={confidenceColors[item.confidence]}>
                          {item.confidence}
                        </Badge>
                        <Badge variant="outline">{item.matched_from}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Qty:</span>{" "}
                        {item.quantity}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cost:</span> {formatCurrency(item.cost_price)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Margin:</span>{" "}
                        {item.margin_percentage}%
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sell:</span> {formatCurrency(item.sell_price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
