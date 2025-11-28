import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Copy, Trash2, Lock, Unlock } from "lucide-react";

interface FabricPropertiesPanelProps {
  canvas: any;
  activeObject: any;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

export const FabricPropertiesPanel = ({ 
  canvas, 
  activeObject,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
}: FabricPropertiesPanelProps) => {
  const [properties, setProperties] = useState<any>({});

  useEffect(() => {
    if (!activeObject) return;

    setProperties({
      left: Math.round(activeObject.left || 0),
      top: Math.round(activeObject.top || 0),
      width: Math.round((activeObject.width || 0) * (activeObject.scaleX || 1)),
      height: Math.round((activeObject.height || 0) * (activeObject.scaleY || 1)),
      angle: Math.round(activeObject.angle || 0),
      opacity: activeObject.opacity || 1,
      fill: activeObject.fill,
      fontSize: activeObject.fontSize,
      fontWeight: activeObject.fontWeight,
      fontFamily: activeObject.fontFamily,
      textAlign: activeObject.textAlign,
      locked: activeObject.locked || false,
    });
  }, [activeObject]);

  const updateProperty = (key: string, value: any) => {
    if (!activeObject || !canvas) return;

    if (key === "width") {
      activeObject.scaleX = value / (activeObject.width || 1);
    } else if (key === "height") {
      activeObject.scaleY = value / (activeObject.height || 1);
    } else if (key === "locked") {
      activeObject.set({
        lockMovementX: value,
        lockMovementY: value,
        lockRotation: value,
        lockScalingX: value,
        lockScalingY: value,
        selectable: !value,
      });
    } else {
      activeObject.set(key, value);
    }

    activeObject.setCoords();
    canvas.renderAll();
    setProperties({ ...properties, [key]: value });
  };

  if (!activeObject) {
    return (
      <div className="w-80 border-l border-border bg-background">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Properties</h2>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">
            Select an element to edit its properties
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-border bg-background">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold">Properties</h2>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 space-y-4">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button onClick={onDuplicate} variant="outline" size="sm" className="flex-1">
              <Copy className="h-4 w-4 mr-1" />
              Duplicate
            </Button>
            <Button onClick={onDelete} variant="outline" size="sm" className="flex-1">
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>

          <Separator />

          {/* Position */}
          <div className="space-y-2">
            <Label>Position</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">X</Label>
                <Input
                  type="number"
                  value={properties.left || 0}
                  onChange={(e) => updateProperty("left", parseInt(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Y</Label>
                <Input
                  type="number"
                  value={properties.top || 0}
                  onChange={(e) => updateProperty("top", parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Size */}
          {activeObject.width && activeObject.height && (
            <div className="space-y-2">
              <Label>Size</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Width</Label>
                  <Input
                    type="number"
                    value={properties.width || 0}
                    onChange={(e) => updateProperty("width", parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Height</Label>
                  <Input
                    type="number"
                    value={properties.height || 0}
                    onChange={(e) => updateProperty("height", parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rotation */}
          <div className="space-y-2">
            <Label>Rotation: {properties.angle}°</Label>
            <Slider
              value={[properties.angle || 0]}
              onValueChange={(v) => updateProperty("angle", v[0])}
              min={0}
              max={360}
              step={1}
            />
          </div>

          {/* Opacity */}
          <div className="space-y-2">
            <Label>Opacity: {Math.round((properties.opacity || 1) * 100)}%</Label>
            <Slider
              value={[(properties.opacity || 1) * 100]}
              onValueChange={(v) => updateProperty("opacity", v[0] / 100)}
              min={0}
              max={100}
              step={1}
            />
          </div>

          <Separator />

          {/* Text Properties */}
          {activeObject.type === "textbox" && (
            <>
              <div className="space-y-2">
                <Label>Font Size</Label>
                <Input
                  type="number"
                  value={properties.fontSize || 16}
                  onChange={(e) => updateProperty("fontSize", parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select
                  value={properties.fontFamily || "Inter"}
                  onValueChange={(v) => updateProperty("fontFamily", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                    <SelectItem value="Roboto">Roboto</SelectItem>
                    <SelectItem value="monospace">Monospace</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Text Align</Label>
                <Select
                  value={properties.textAlign || "left"}
                  onValueChange={(v) => updateProperty("textAlign", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />
            </>
          )}

          {/* Layer Actions */}
          <div className="space-y-2">
            <Label>Layer</Label>
            <div className="flex gap-2">
              <Button onClick={onBringToFront} variant="outline" size="sm" className="flex-1">
                To Front
              </Button>
              <Button onClick={onSendToBack} variant="outline" size="sm" className="flex-1">
                To Back
              </Button>
            </div>
          </div>

          {/* Lock */}
          <Button
            onClick={() => updateProperty("locked", !properties.locked)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {properties.locked ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Locked
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 mr-2" />
                Unlocked
              </>
            )}
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
};
