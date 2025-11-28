import { useEditor } from "@craftjs/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const TemplateSettings = () => {
  const { selected, actions, query } = useEditor((state, query) => {
    const currentNodeId = query.getEvent('selected').last();
    let selected;

    if (currentNodeId) {
      selected = {
        id: currentNodeId,
        name: state.nodes[currentNodeId].data.name,
        settings: state.nodes[currentNodeId].related?.settings,
        isDeletable: query.node(currentNodeId).isDeletable(),
      };
    }

    return { selected };
  });

  return (
    <div className="w-80 border-l border-border bg-background">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold">Properties</h2>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 space-y-4">
          {selected ? (
            <div>
              <div className="mb-4">
                <p className="text-sm font-medium">{selected.name}</p>
              </div>
              {selected.settings && selected.settings}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a component to edit its properties
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};