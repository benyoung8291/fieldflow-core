import { Button } from "@/components/ui/button";
import { MapPin, Square, Hand, ZoomIn, ZoomOut, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarkupType } from "../FloorPlanViewer";

interface MobileFloorPlanToolbarProps {
  mode: MarkupType | "pan";
  onModeChange: (mode: MarkupType | "pan") => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  markupsCount: number;
  onOpenMarkups: () => void;
  readOnly?: boolean;
}

export function MobileFloorPlanToolbar({
  mode,
  onModeChange,
  scale,
  onZoomIn,
  onZoomOut,
  markupsCount,
  onOpenMarkups,
  readOnly = false,
}: MobileFloorPlanToolbarProps) {
  return (
    <>
      {/* Top Left Markups Button */}
      {!readOnly && (
        <div className="absolute top-4 left-4 z-20">
          <Button
            variant="default"
            onClick={onOpenMarkups}
            className="h-12 rounded-full shadow-lg px-4 gap-2"
          >
            <List className="h-5 w-5" />
            <span className="font-semibold">Markups</span>
            {markupsCount > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full px-2 py-0.5">
                {markupsCount}
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* Top Right Zoom Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <Button
          size="icon"
          variant="default"
          onClick={onZoomIn}
          disabled={scale >= 3}
          className="h-12 w-12 rounded-full shadow-lg"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Badge 
          variant="default" 
          className="rounded-full px-3 py-2 font-semibold text-sm shadow-lg"
        >
          {Math.round(scale * 100)}%
        </Badge>
        <Button
          size="icon"
          variant="default"
          onClick={onZoomOut}
          disabled={scale <= 0.5}
          className="h-12 w-12 rounded-full shadow-lg"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Bottom Tool Selection - Only show in edit mode */}
      {!readOnly && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-full bg-background shadow-2xl border-2 border-border">
            <Button
              size="icon"
              variant={mode === "pan" ? "default" : "secondary"}
              onClick={() => onModeChange("pan")}
              className={cn(
                "h-11 w-11 rounded-full transition-all",
                mode === "pan" ? "bg-primary text-primary-foreground shadow-md scale-105" : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
              )}
              title="Pan"
            >
              <Hand className="h-5 w-5" />
            </Button>
            
            <div className="w-px h-6 bg-border" />
            
            <Button
              size="icon"
              variant={mode === "pin" ? "default" : "secondary"}
              onClick={() => onModeChange("pin")}
              className={cn(
                "h-11 w-11 rounded-full transition-all",
                mode === "pin" ? "bg-primary text-primary-foreground shadow-md scale-105" : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
              )}
              title="Add Pin"
            >
              <MapPin className="h-5 w-5" />
            </Button>
            
            <Button
              size="icon"
              variant={mode === "zone" ? "default" : "secondary"}
              onClick={() => onModeChange("zone")}
              className={cn(
                "h-11 w-11 rounded-full transition-all",
                mode === "zone" ? "bg-primary text-primary-foreground shadow-md scale-105" : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
              )}
              title="Draw Area"
            >
              <Square className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
