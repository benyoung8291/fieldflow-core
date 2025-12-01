import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Image as ImageIcon, MessageSquare, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkupResponseForm } from "./MarkupResponseForm";
import { useState } from "react";

interface MarkupResponsePanelProps {
  markups: any[];
  ticketId: string;
  onResponseSubmitted: () => void;
}

export function MarkupResponsePanel({ markups, ticketId, onResponseSubmitted }: MarkupResponsePanelProps) {
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "in_progress":
        return <Circle className="h-4 w-4 text-warning animate-pulse" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-warning/10 text-warning border-warning/20">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const selectedMarkup = markups.find(m => m.id === selectedMarkupId);

  return (
    <Card className="border-primary/20 h-full flex flex-col">
      <CardHeader className="shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Markup Responses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 overflow-auto">
        {markups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No markups on this request
          </p>
        ) : (
          <>
            {/* Markups List */}
            <div className="space-y-2">
              {markups.map((markup: any, index: number) => (
                <div
                  key={markup.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50",
                    selectedMarkupId === markup.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedMarkupId(markup.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon(markup.status)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {markup.markup_data?.type === "pin" ? "📍 Pin" : "🔲 Zone"} #{index + 1}
                            </span>
                            {getStatusBadge(markup.status)}
                          </div>
                          {markup.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {markup.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Customer's photo */}
                      {markup.photo_url && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ImageIcon className="h-3 w-3" />
                          <span>Customer photo attached</span>
                        </div>
                      )}

                      {/* Worker's response preview */}
                      {markup.response_notes && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                          <p className="font-medium mb-1">Response:</p>
                          <p className="text-muted-foreground line-clamp-2">{markup.response_notes}</p>
                        </div>
                      )}

                      {/* Worker's response photos */}
                      {markup.response_photos && Array.isArray(markup.response_photos) && markup.response_photos.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-success">
                          <Camera className="h-3 w-3" />
                          <span>{markup.response_photos.length} response photo(s)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Response Form for Selected Markup */}
            {selectedMarkupId && selectedMarkup && (
              <MarkupResponseForm
                markup={selectedMarkup}
                ticketId={ticketId}
                onSuccess={() => {
                  onResponseSubmitted();
                  setSelectedMarkupId(null);
                }}
                onCancel={() => setSelectedMarkupId(null)}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
