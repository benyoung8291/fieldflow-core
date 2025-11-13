import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { DollarSign, User, Calendar, ExternalLink, Eye } from "lucide-react";

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

interface DraggableQuoteCardProps {
  quote: Quote;
  onQuickView: (quoteId: string) => void;
}

export default function DraggableQuoteCard({ quote, onQuickView }: DraggableQuoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: quote.id,
    data: { quote },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const customerName = quote.customer?.name || quote.lead?.name || 'Unknown';
  const ownerName = quote.quote_owner 
    ? `${quote.quote_owner.first_name || ''} ${quote.quote_owner.last_name || ''}`.trim() 
    : null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        className={cn(
          "mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
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
            {formatCurrency(quote.total_amount || 0)}
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

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(quote.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Eye className="h-3 w-3 mr-1" />
              Quick View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/quotes/${quote.id}`, '_blank');
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Full Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
