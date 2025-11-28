import { useEditor, Element } from "@craftjs/core";
import { Container } from "./craft/Container";
import { RichTextBlock } from "./craft/RichTextBlock";
import { DataField } from "./craft/DataField";
import { LineItemsTable } from "./craft/LineItemsTable";
import { ImageBlock } from "./craft/ImageBlock";
import { ShapeBlock } from "./craft/ShapeBlock";
import { GradientBackground } from "./craft/GradientBackground";
import { PreBuiltBlocks } from "./PreBuiltBlocks";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Box, 
  Type, 
  Database, 
  Table,
  Image,
  Square,
  Circle,
  Minus,
  Layers
} from "lucide-react";

export const EnhancedToolbox = () => {
  const { connectors } = useEditor();

  const layoutComponents = [
    {
      icon: Box,
      name: "Container",
      description: "Group elements",
      component: <Element is={Container} canvas />
    },
    {
      icon: Layers,
      name: "Section",
      description: "Full-width section",
      component: <Element is={Container} canvas background="#f8f9fa" padding={32} />
    }
  ];

  const textComponents = [
    {
      icon: Type,
      name: "Heading",
      description: "Large heading text",
      component: <RichTextBlock text="Heading" fontSize={32} fontWeight={700} />
    },
    {
      icon: Type,
      name: "Text",
      description: "Body text",
      component: <RichTextBlock text="Your text here" fontSize={16} />
    },
    {
      icon: Database,
      name: "Data Field",
      description: "Dynamic data",
      component: <DataField />
    }
  ];

  const mediaComponents = [
    {
      icon: Image,
      name: "Image",
      description: "Upload image",
      component: <ImageBlock />
    },
    {
      icon: Square,
      name: "Logo",
      description: "Company logo",
      component: <ImageBlock width={150} height={60} />
    }
  ];

  const shapeComponents = [
    {
      icon: Square,
      name: "Rectangle",
      description: "Box shape",
      component: <ShapeBlock shape="rectangle" width={200} height={100} background="#e0e0e0" />
    },
    {
      icon: Circle,
      name: "Circle",
      description: "Round shape",
      component: <ShapeBlock shape="circle" width={100} background="#e0e0e0" />
    },
    {
      icon: Minus,
      name: "Line",
      description: "Divider line",
      component: <ShapeBlock shape="line" width={300} borderWidth={2} background="#e0e0e0" />
    },
    {
      icon: Layers,
      name: "Gradient",
      description: "Gradient section",
      component: <Element is={GradientBackground} canvas />
    }
  ];

  const dataComponents = [
    {
      icon: Table,
      name: "Line Items",
      description: "Product table",
      component: <LineItemsTable />
    }
  ];

  const ComponentGroup = ({ title, components }: { title: string; components: any[] }) => (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase px-2">{title}</h3>
      <div className="space-y-1">
        {components.map((item) => (
          <Button
            key={item.name}
            ref={(ref) => ref && connectors.create(ref, item.component)}
            variant="ghost"
            className="w-full justify-start h-auto p-3 hover:bg-muted"
          >
            <div className="flex items-start gap-3 w-full">
              <div className="p-2 rounded bg-primary/10">
                <item.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-72 border-r border-border bg-background">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold">Elements</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Drag elements onto the canvas
        </p>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 space-y-6">
          <ComponentGroup title="Layout" components={layoutComponents} />
          <Separator />
          <ComponentGroup title="Text" components={textComponents} />
          <Separator />
          <ComponentGroup title="Media" components={mediaComponents} />
          <Separator />
          <ComponentGroup title="Shapes" components={shapeComponents} />
          <Separator />
          <ComponentGroup title="Data" components={dataComponents} />
          <Separator />
          <PreBuiltBlocks />
        </div>
      </ScrollArea>
    </div>
  );
};