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
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          onClick={onZoomIn}
          disabled={scale >= 3}
          className="h-12 w-12 rounded-full shadow-lg bg-background/95 backdrop-blur"
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
          className="h-12 w-12 rounded-full shadow-lg bg-background/95 backdrop-blur"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Bottom Tool Selection */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-background/95 backdrop-blur shadow-2xl border border-border/50">
          <Button
            size="icon"
            variant={mode === "pan" ? "default" : "ghost"}
            onClick={() => onModeChange("pan")}
            className={cn(
              "h-12 w-12 rounded-full transition-all",
              mode === "pan" && "shadow-md scale-110"
            )}
          >
            <Hand className="h-5 w-5" />
          </Button>
          
          <div className="w-px h-8 bg-border/50" />
          
          <Button
            size="icon"
            variant={mode === "pin" ? "default" : "ghost"}
            onClick={() => onModeChange("pin")}
            className={cn(
              "h-12 w-12 rounded-full transition-all",
              mode === "pin" && "shadow-md scale-110"
            )}
          >
            <MapPin className="h-5 w-5" />
          </Button>
          
          <Button
            size="icon"
            variant={mode === "zone" ? "default" : "ghost"}
            onClick={() => onModeChange("zone")}
            className={cn(
              "h-12 w-12 rounded-full transition-all",
              mode === "zone" && "shadow-md scale-110"
            )}
          >
            <Square className="h-5 w-5" />
          </Button>
          
          <div className="w-px h-8 bg-border/50" />
          
          <Button
            size="icon"
            variant="ghost"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-12 w-12 rounded-full"
          >
            <Undo className="h-5 w-5" />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-12 w-12 rounded-full"
          >
            <Redo className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  );
}
