import { useEditor } from "@craftjs/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AdvancedPropertiesPanel = () => {
  const { toast } = useToast();
  const { selected, actions, query } = useEditor((state, query) => {
    const currentNodeId = query.getEvent('selected').last();
    let selected;

    if (currentNodeId) {
      const node = state.nodes[currentNodeId];
      selected = {
        id: currentNodeId,
        name: node.data.name,
        props: node.data.props,
        isDeletable: query.node(currentNodeId).isDeletable(),
      };
    }

    return { selected };
  });

  const handlePropChange = (propName: string, value: any) => {
    if (selected) {
      actions.setProp(selected.id, (props: any) => {
        props[propName] = value;
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('template-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('template-assets')
        .getPublicUrl(filePath);

      handlePropChange('src', publicUrl);
      
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = () => {
    if (selected && selected.isDeletable) {
      actions.delete(selected.id);
    }
  };

  if (!selected) {
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
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold">{selected.name}</h2>
        {selected.isDeletable && (
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 space-y-6">
          <Tabs defaultValue="style" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="style">Style</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>
            
            <TabsContent value="style" className="space-y-4 mt-4">
              {/* Image Upload for ImageBlock */}
              {selected.name === "Image" && (
                <div className="space-y-2">
                  <Label>Image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  {selected.props.src && (
                    <img 
                      src={selected.props.src} 
                      alt="Preview" 
                      className="w-full h-32 object-contain border rounded"
                    />
                  )}
                </div>
              )}

              {/* Font Family for text elements */}
              {(selected.name === "Rich Text" || selected.name === "Text") && (
                <>
                  <div className="space-y-2">
                    <Label>Font Family</Label>
                    <Select 
                      value={selected.props.fontFamily || "inherit"} 
                      onValueChange={(v) => handlePropChange('fontFamily', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Default</SelectItem>
                        <SelectItem value="'Inter', sans-serif">Inter</SelectItem>
                        <SelectItem value="'Playfair Display', serif">Playfair Display</SelectItem>
                        <SelectItem value="'Roboto', sans-serif">Roboto</SelectItem>
                        <SelectItem value="monospace">Monospace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Font Size: {selected.props.fontSize}px</Label>
                    <Slider
                      value={[selected.props.fontSize || 14]}
                      onValueChange={(v) => handlePropChange('fontSize', v[0])}
                      min={8}
                      max={120}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Font Weight: {selected.props.fontWeight}</Label>
                    <Slider
                      value={[selected.props.fontWeight || 400]}
                      onValueChange={(v) => handlePropChange('fontWeight', v[0])}
                      min={100}
                      max={900}
                      step={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Text Align</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={selected.props.textAlign === "left" ? "default" : "outline"}
                        size="icon"
                        onClick={() => handlePropChange('textAlign', 'left')}
                      >
                        <AlignLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={selected.props.textAlign === "center" ? "default" : "outline"}
                        size="icon"
                        onClick={() => handlePropChange('textAlign', 'center')}
                      >
                        <AlignCenter className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={selected.props.textAlign === "right" ? "default" : "outline"}
                        size="icon"
                        onClick={() => handlePropChange('textAlign', 'right')}
                      >
                        <AlignRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={selected.props.color || "#000000"}
                      onChange={(e) => handlePropChange('color', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Line Height: {selected.props.lineHeight}</Label>
                    <Slider
                      value={[selected.props.lineHeight || 1.5]}
                      onValueChange={(v) => handlePropChange('lineHeight', v[0])}
                      min={0.5}
                      max={3}
                      step={0.1}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Letter Spacing: {selected.props.letterSpacing}px</Label>
                    <Slider
                      value={[selected.props.letterSpacing || 0]}
                      onValueChange={(v) => handlePropChange('letterSpacing', v[0])}
                      min={-5}
                      max={20}
                      step={0.5}
                    />
                  </div>
                </>
              )}

              {/* Shape properties */}
              {selected.name === "Shape" && (
                <>
                  <div className="space-y-2">
                    <Label>Shape Type</Label>
                    <Select 
                      value={selected.props.shape || "rectangle"} 
                      onValueChange={(v) => handlePropChange('shape', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rectangle">Rectangle</SelectItem>
                        <SelectItem value="circle">Circle</SelectItem>
                        <SelectItem value="line">Line</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Background Color</Label>
                    <Input
                      type="color"
                      value={selected.props.background || "#000000"}
                      onChange={(e) => handlePropChange('background', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Border Radius: {selected.props.borderRadius}px</Label>
                    <Slider
                      value={[selected.props.borderRadius || 0]}
                      onValueChange={(v) => handlePropChange('borderRadius', v[0])}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                </>
              )}

              {/* Gradient properties */}
              {selected.name === "Gradient Section" && (
                <>
                  <div className="space-y-2">
                    <Label>Start Color</Label>
                    <Input
                      type="color"
                      value={selected.props.gradientFrom || "#667eea"}
                      onChange={(e) => handlePropChange('gradientFrom', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>End Color</Label>
                    <Input
                      type="color"
                      value={selected.props.gradientTo || "#764ba2"}
                      onChange={(e) => handlePropChange('gradientTo', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Direction: {selected.props.gradientDirection}°</Label>
                    <Slider
                      value={[selected.props.gradientDirection || 135]}
                      onValueChange={(v) => handlePropChange('gradientDirection', v[0])}
                      min={0}
                      max={360}
                      step={15}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Padding: {selected.props.padding}px</Label>
                    <Slider
                      value={[selected.props.padding || 32]}
                      onValueChange={(v) => handlePropChange('padding', v[0])}
                      min={0}
                      max={100}
                      step={4}
                    />
                  </div>
                </>
              )}

              {/* Common properties */}
              {(selected.name === "Image" || selected.name === "Shape") && (
                <>
                  <div className="space-y-2">
                    <Label>Width: {selected.props.width}px</Label>
                    <Slider
                      value={[selected.props.width || 100]}
                      onValueChange={(v) => handlePropChange('width', v[0])}
                      min={20}
                      max={800}
                      step={10}
                    />
                  </div>

                  {selected.name !== "Shape" || selected.props.shape !== "line" && (
                    <div className="space-y-2">
                      <Label>Height: {selected.props.height}px</Label>
                      <Slider
                        value={[selected.props.height || 100]}
                        onValueChange={(v) => handlePropChange('height', v[0])}
                        min={20}
                        max={800}
                        step={10}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Opacity: {selected.props.opacity * 100}%</Label>
                    <Slider
                      value={[selected.props.opacity || 1]}
                      onValueChange={(v) => handlePropChange('opacity', v[0])}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>
                </>
              )}

              {/* Container properties */}
              {selected.name === "Container" && (
                <>
                  <div className="space-y-2">
                    <Label>Position Type</Label>
                    <Select 
                      value={selected.props.position || "relative"} 
                      onValueChange={(v) => handlePropChange('position', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relative">Relative (Flow)</SelectItem>
                        <SelectItem value="absolute">Absolute (Free)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selected.props.position === "absolute" && (
                    <>
                      <div className="space-y-2">
                        <Label>X Position: {selected.props.x}px</Label>
                        <Slider
                          value={[selected.props.x || 0]}
                          onValueChange={(v) => handlePropChange('x', v[0])}
                          min={0}
                          max={800}
                          step={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Y Position: {selected.props.y}px</Label>
                        <Slider
                          value={[selected.props.y || 0]}
                          onValueChange={(v) => handlePropChange('y', v[0])}
                          min={0}
                          max={1200}
                          step={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Width: {selected.props.width === "auto" ? "Auto" : `${selected.props.width}px`}</Label>
                        <Slider
                          value={[typeof selected.props.width === "number" ? selected.props.width : 200]}
                          onValueChange={(v) => handlePropChange('width', v[0])}
                          min={50}
                          max={800}
                          step={10}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Height: {selected.props.height === "auto" ? "Auto" : `${selected.props.height}px`}</Label>
                        <Slider
                          value={[typeof selected.props.height === "number" ? selected.props.height : 100]}
                          onValueChange={(v) => handlePropChange('height', v[0])}
                          min={50}
                          max={600}
                          step={10}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Padding: {selected.props.padding}px</Label>
                    <Slider
                      value={[selected.props.padding || 16]}
                      onValueChange={(v) => handlePropChange('padding', v[0])}
                      min={0}
                      max={100}
                      step={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Gap: {selected.props.gap}px</Label>
                    <Slider
                      value={[selected.props.gap || 8]}
                      onValueChange={(v) => handlePropChange('gap', v[0])}
                      min={0}
                      max={100}
                      step={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Background Color</Label>
                    <Input
                      type="color"
                      value={selected.props.background || "#ffffff"}
                      onChange={(e) => handlePropChange('background', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select 
                      value={selected.props.flexDirection || "column"} 
                      onValueChange={(v) => handlePropChange('flexDirection', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="column">Vertical</SelectItem>
                        <SelectItem value="row">Horizontal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="content" className="space-y-4 mt-4">
              {selected.name === "Data Field" && (
                <>
                  <div className="space-y-2">
                    <Label>Field Path</Label>
                    <Input
                      value={selected.props.field || ""}
                      onChange={(e) => handlePropChange('field', e.target.value)}
                      placeholder="customer.name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={selected.props.label || ""}
                      onChange={(e) => handlePropChange('label', e.target.value)}
                      placeholder="Customer Name"
                    />
                  </div>
                </>
              )}

              {(selected.name === "Text" || selected.name === "Rich Text") && (
                <div className="space-y-2">
                  <Label>Text Content</Label>
                  <textarea
                    className="w-full min-h-[100px] p-2 border rounded-md"
                    value={selected.props.text || ""}
                    onChange={(e) => handlePropChange('text', e.target.value)}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
};