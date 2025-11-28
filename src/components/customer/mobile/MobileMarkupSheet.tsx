import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, MapPin, Square, X } from "lucide-react";
import { Markup } from "../FloorPlanViewer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MobileMarkupSheetProps {
  markups: Markup[];
  selectedMarkupId: string | null;
  onMarkupSelect: (id: string | null) => void;
  onMarkupUpdate: (id: string, notes: string) => void;
  onMarkupDelete: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMarkupSheet({
  markups,
  selectedMarkupId,
  onMarkupSelect,
  onMarkupUpdate,
  onMarkupDelete,
  open,
  onOpenChange,
}: MobileMarkupSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] max-w-[95vw] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-4 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Markup List</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 px-4">
          <div className="py-4">
            {markups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">No markups yet</p>
                <p className="text-sm">Tap the pin or area button to add markups</p>
              </div>
            ) : (
              <div className="space-y-3">
                {markups.map((markup, index) => (
                  <Card
                    key={markup.id}
                    className={cn(
                      "p-4 transition-all cursor-pointer",
                      selectedMarkupId === markup.id && "ring-2 ring-primary shadow-lg"
                    )}
                    onClick={() => onMarkupSelect(markup.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {markup.type === "pin" ? (
                          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-destructive" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <Square className="h-5 w-5 text-yellow-600" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="font-semibold">
                            #{index + 1}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {markup.type === "pin" ? "Pin" : "Area"}
                          </span>
                        </div>
                        
                        <Input
                          placeholder="Add notes..."
                          value={markup.notes || ""}
                          onChange={(e) => {
                            e.stopPropagation();
                            onMarkupUpdate(markup.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-base"
                        />
                      </div>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkupDelete(markup.id);
                        }}
                        className="flex-shrink-0 h-10 w-10"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
