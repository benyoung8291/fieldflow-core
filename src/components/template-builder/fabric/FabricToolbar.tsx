import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Undo, 
  Redo, 
  ZoomIn, 
  ZoomOut,
  Maximize,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
} from "lucide-react";
import { useFabricEditor } from "@/hooks/useFabricEditor";

interface FabricToolbarProps {
  canvas: any;
}

export const FabricToolbar = ({ canvas }: FabricToolbarProps) => {
  const { undo, redo, canUndo, canRedo, alignObjects } = useFabricEditor();

  const handleZoom = (delta: number) => {
    if (!canvas) return;
    let zoom = canvas.getZoom();
    zoom = Math.min(Math.max(zoom + delta, 0.25), 2);
    canvas.setZoom(zoom);
    canvas.renderAll();
  };

  const handleZoomToFit = () => {
    if (!canvas) return;
    canvas.setZoom(1);
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    canvas.renderAll();
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-border bg-background">
      {/* Undo/Redo */}
      <Button
        onClick={undo}
        disabled={!canUndo}
        variant="ghost"
        size="sm"
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        onClick={redo}
        disabled={!canRedo}
        variant="ghost"
        size="sm"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Zoom */}
      <Button
        onClick={() => handleZoom(-0.1)}
        variant="ghost"
        size="sm"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => handleZoom(0.1)}
        variant="ghost"
        size="sm"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        onClick={handleZoomToFit}
        variant="ghost"
        size="sm"
        title="Fit to Screen"
      >
        <Maximize className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Alignment */}
      <Button
        onClick={() => alignObjects('left')}
        variant="ghost"
        size="sm"
        title="Align Left"
      >
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => alignObjects('center')}
        variant="ghost"
        size="sm"
        title="Align Center"
      >
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => alignObjects('right')}
        variant="ghost"
        size="sm"
        title="Align Right"
      >
        <AlignRight className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        onClick={() => alignObjects('top')}
        variant="ghost"
        size="sm"
        title="Align Top"
      >
        <AlignStartVertical className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => alignObjects('middle')}
        variant="ghost"
        size="sm"
        title="Align Middle"
      >
        <AlignCenterVertical className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => alignObjects('bottom')}
        variant="ghost"
        size="sm"
        title="Align Bottom"
      >
        <AlignEndVertical className="h-4 w-4" />
      </Button>
    </div>
  );
};
