import { useEditor } from "@craftjs/core";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut,
  Eye,
  Download,
  Ruler
} from "lucide-react";

interface CanvasToolbarProps {
  onPreview: () => void;
  onExport: () => void;
  pageMargins: { top: number; right: number; bottom: number; left: number };
  onPageMarginsChange: (margins: { top: number; right: number; bottom: number; left: number }) => void;
}

export const CanvasToolbar = ({ onPreview, onExport, pageMargins, onPageMarginsChange }: CanvasToolbarProps) => {
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

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title="Page Margins">
            <Ruler className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Page Margins (mm)</h4>
              <p className="text-xs text-muted-foreground">A4 Portrait: 210mm × 297mm</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="margin-top" className="text-xs">Top</Label>
                <Input
                  id="margin-top"
                  type="number"
                  value={pageMargins.top}
                  onChange={(e) => onPageMarginsChange({ ...pageMargins, top: Number(e.target.value) })}
                  min={0}
                  max={50}
                  className="h-8"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="margin-right" className="text-xs">Right</Label>
                <Input
                  id="margin-right"
                  type="number"
                  value={pageMargins.right}
                  onChange={(e) => onPageMarginsChange({ ...pageMargins, right: Number(e.target.value) })}
                  min={0}
                  max={50}
                  className="h-8"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="margin-bottom" className="text-xs">Bottom</Label>
                <Input
                  id="margin-bottom"
                  type="number"
                  value={pageMargins.bottom}
                  onChange={(e) => onPageMarginsChange({ ...pageMargins, bottom: Number(e.target.value) })}
                  min={0}
                  max={50}
                  className="h-8"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="margin-left" className="text-xs">Left</Label>
                <Input
                  id="margin-left"
                  type="number"
                  value={pageMargins.left}
                  onChange={(e) => onPageMarginsChange({ ...pageMargins, left: Number(e.target.value) })}
                  min={0}
                  max={50}
                  className="h-8"
                />
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full h-8"
              onClick={() => onPageMarginsChange({ top: 20, right: 20, bottom: 20, left: 20 })}
            >
              Reset to Default (20mm)
            </Button>
          </div>
        </PopoverContent>
      </Popover>

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