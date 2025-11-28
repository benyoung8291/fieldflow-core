import { useEditor } from "@craftjs/core";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut,
  Eye,
  Download,
  Layers
} from "lucide-react";

interface CanvasToolbarProps {
  onPreview: () => void;
  onExport: () => void;
}

export const CanvasToolbar = ({ onPreview, onExport }: CanvasToolbarProps) => {
  const { actions, canUndo, canRedo, enabled } = useEditor((state, query) => ({
    enabled: state.options.enabled,
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }));

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-background border border-border rounded-lg shadow-lg p-2 flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => actions.history.undo()}
        disabled={!canUndo}
        title="Undo"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => actions.history.redo()}
        disabled={!canRedo}
        title="Redo"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
      
      <Separator orientation="vertical" className="h-6 mx-1" />
      
      <Button
        variant="ghost"
        size="icon"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Button
        variant="ghost"
        size="icon"
        onClick={onPreview}
        title="Preview"
      >
        <Eye className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onExport}
        title="Export PDF"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
};