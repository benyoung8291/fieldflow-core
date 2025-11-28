import { useEffect, useRef } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { useFabricEditor } from "@/hooks/useFabricEditor";

interface FabricCanvasProps {
  onReady?: (canvas: FabricCanvas) => void;
  onSelectionChange?: (obj: any) => void;
}

export const FabricCanvasComponent = ({ onReady, onSelectionChange }: FabricCanvasProps) => {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const { canvasRef, setActiveObject, saveHistory } = useFabricEditor();

  useEffect(() => {
    if (!canvasElRef.current) return;

    // A4 dimensions at 72 DPI
    const canvas = new FabricCanvas(canvasElRef.current, {
      width: 595,
      height: 842,
      backgroundColor: "#ffffff",
    });

    canvasRef.current = canvas;

    // Enable selection and controls
    canvas.selection = true;
    canvas.preserveObjectStacking = true;

    // Handle selection events
    canvas.on("selection:created", (e: any) => {
      setActiveObject(e.selected?.[0] || null);
      onSelectionChange?.(e.selected?.[0] || null);
    });

    canvas.on("selection:updated", (e: any) => {
      setActiveObject(e.selected?.[0] || null);
      onSelectionChange?.(e.selected?.[0] || null);
    });

    canvas.on("selection:cleared", () => {
      setActiveObject(null);
      onSelectionChange?.(null);
    });

    // Save history on object modifications
    canvas.on("object:modified", () => {
      saveHistory();
    });

    canvas.on("object:added", () => {
      saveHistory();
    });

    canvas.on("object:removed", () => {
      saveHistory();
    });

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Delete
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeObject = canvas.getActiveObject();
        if (activeObject && !(activeObject as any).isEditing) {
          e.preventDefault();
          canvas.remove(activeObject);
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      }

      // Copy (Ctrl/Cmd + C)
      if (cmdOrCtrl && e.key === "c") {
        const activeObject = canvas.getActiveObject();
        if (activeObject && !(activeObject as any).isEditing) {
          e.preventDefault();
          (async () => {
            (canvas as any)._clipboard = await activeObject.clone();
          })();
        }
      }

      // Paste (Ctrl/Cmd + V)
      if (cmdOrCtrl && e.key === "v") {
        if ((canvas as any)._clipboard) {
          e.preventDefault();
          (async () => {
            const cloned = await (canvas as any)._clipboard.clone();
            cloned.set({
              left: (cloned.left || 0) + 10,
              top: (cloned.top || 0) + 10,
            });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.renderAll();
          })();
        }
      }

      // Duplicate (Ctrl/Cmd + D)
      if (cmdOrCtrl && e.key === "d") {
        const activeObject = canvas.getActiveObject();
        if (activeObject && !(activeObject as any).isEditing) {
          e.preventDefault();
          (async () => {
            const cloned = await activeObject.clone();
            cloned.set({
              left: (cloned.left || 0) + 10,
              top: (cloned.top || 0) + 10,
            });
            canvas.add(cloned);
            canvas.setActiveObject(cloned);
            canvas.renderAll();
          })();
        }
      }

      // Select All (Ctrl/Cmd + A)
      if (cmdOrCtrl && e.key === "a") {
        e.preventDefault();
        canvas.discardActiveObject();
        const allObjects = canvas.getObjects();
        const sel = new (FabricCanvas as any).ActiveSelection(allObjects, { canvas });
        canvas.setActiveObject(sel);
        canvas.renderAll();
      }

      // Nudge with arrow keys
      const activeObject = canvas.getActiveObject();
      if (activeObject && !(activeObject as any).isEditing) {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          activeObject.set({ left: (activeObject.left || 0) - step });
          activeObject.setCoords();
          canvas.renderAll();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          activeObject.set({ left: (activeObject.left || 0) + step });
          activeObject.setCoords();
          canvas.renderAll();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          activeObject.set({ top: (activeObject.top || 0) - step });
          activeObject.setCoords();
          canvas.renderAll();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          activeObject.set({ top: (activeObject.top || 0) + step });
          activeObject.setCoords();
          canvas.renderAll();
        }
      }

      // Escape to deselect
      if (e.key === "Escape") {
        canvas.discardActiveObject();
        canvas.renderAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    onReady?.(canvas);

    // Initial history state
    saveHistory();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      canvas.dispose();
    };
  }, []);

  return (
    <div className="flex items-center justify-center bg-muted/30 p-8">
      <div className="shadow-lg border border-border">
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
};
