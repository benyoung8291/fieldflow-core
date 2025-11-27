import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, MapPin, Square } from "lucide-react";
import { Markup } from "./FloorPlanViewer";
import { cn } from "@/lib/utils";

interface FloorPlanMarkupListProps {
  markups: Markup[];
  onMarkupUpdate: (id: string, notes: string) => void;
  onMarkupDelete: (id: string) => void;
  selectedMarkupId: string | null;
  onMarkupSelect: (id: string) => void;
}

export function FloorPlanMarkupList({
  markups,
  onMarkupUpdate,
  onMarkupDelete,
  selectedMarkupId,
  onMarkupSelect,
}: FloorPlanMarkupListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Markups ({markups.length})</h3>
      </div>

      {markups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Tap on the floor plan to add pins or drag to draw areas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {markups.map((markup, index) => (
            <Card
              key={markup.id}
              className={cn(
                "transition-all cursor-pointer hover:shadow-md",
                selectedMarkupId === markup.id && "ring-2 ring-primary"
              )}
              onClick={() => onMarkupSelect(markup.id)}
            >
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {markup.type === "pin" ? (
                      <MapPin className="h-4 w-4 text-destructive flex-shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-sm">
                      {markup.type === "pin" ? "Pin" : "Area"} #{index + 1}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkupDelete(markup.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div onClick={(e) => e.stopPropagation()}>
                  <Label htmlFor={`note-${markup.id}`} className="text-xs">
                    Note
                  </Label>
                  <Input
                    id={`note-${markup.id}`}
                    value={markup.notes || ""}
                    onChange={(e) => onMarkupUpdate(markup.id, e.target.value)}
                    placeholder="Add a note..."
                    className="text-sm h-8 mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
