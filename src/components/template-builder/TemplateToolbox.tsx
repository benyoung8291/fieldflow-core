import { useEditor, Element } from "@craftjs/core";
import { Container } from "./craft/Container";
import { TextBlock } from "./craft/TextBlock";
import { DataField } from "./craft/DataField";
import { LineItemsTable } from "./craft/LineItemsTable";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Box, 
  Type, 
  Database, 
  Table,
  Image,
  Minus
} from "lucide-react";

export const TemplateToolbox = () => {
  const { connectors } = useEditor();

  const components = [
    {
      icon: Box,
      name: "Container",
      component: <Element is={Container} canvas />
    },
    {
      icon: Type,
      name: "Text",
      component: <TextBlock />
    },
    {
      icon: Database,
      name: "Data Field",
      component: <DataField />
    },
    {
      icon: Table,
      name: "Line Items",
      component: <LineItemsTable />
    },
    {
      icon: Minus,
      name: "Divider",
      component: <div style={{ height: "1px", background: "hsl(var(--border))", width: "100%" }} />
    }
  ];

  return (
    <div className="w-64 border-r border-border bg-background">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold">Components</h2>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 space-y-2">
          {components.map((item) => (
            <Button
              key={item.name}
              ref={(ref) => ref && connectors.create(ref, item.component)}
              variant="outline"
              className="w-full justify-start"
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.name}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};