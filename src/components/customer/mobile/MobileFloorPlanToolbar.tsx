import { Button } from "@/components/ui/button";
import { MapPin, Square, Hand, Undo, Redo, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarkupType } from "../FloorPlanViewer";

interface MobileFloorPlanToolbarProps {
  mode: MarkupType | "pan";
  onModeChange: (mode: MarkupType | "pan") => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function MobileFloorPlanToolbar({
  mode,
  onModeChange,
  scale,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: MobileFloorPlanToolbarProps) {
  return (
    <>
      {/* Top Zoom Controls */}
      <div className="absolute top-20 right-4 z-20 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          onClick={onZoomIn}
          disabled={scale >= 3}
          className="h-12 w-12 rounded-full shadow-lg bg-background/95 backdrop-blur hover:bg-background"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Badge 
          variant="secondary" 
          className="rounded-full px-3 py-2 font-semibold text-sm shadow-lg bg-background/95 backdrop-blur"
        >
          {Math.round(scale * 100)}%
        </Badge>
        <Button
          size="icon"
          variant="secondary"
          onClick={onZoomOut}
          disabled={scale <= 0.5}
          className="h-12 w-12 rounded-full shadow-lg bg-background/95 backdrop-blur hover:bg-background"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Bottom Tool Selection */}
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
          
          <div className="w-px h-6 bg-border" />
          
          <Button
            size="icon"
            variant="secondary"
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              "h-11 w-11 rounded-full bg-secondary/80 text-secondary-foreground hover:bg-secondary",
              !canUndo && "opacity-40"
            )}
            title="Undo"
          >
            <Undo className="h-5 w-5" />
          </Button>
          
          <Button
            size="icon"
            variant="secondary"
            onClick={onRedo}
            disabled={!canRedo}
            className={cn(
              "h-11 w-11 rounded-full bg-secondary/80 text-secondary-foreground hover:bg-secondary",
              !canRedo && "opacity-40"
            )}
            title="Redo"
          >
            <Redo className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  );
}
