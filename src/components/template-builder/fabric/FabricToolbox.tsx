import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Type, 
  Square, 
  Circle, 
  Minus,
  Database,
  Table,
  Heading1,
  Heading2
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { addText, addHeading, addSubheading, addBodyText } from "./objects/addText";
import { addRectangle, addCircle, addLine } from "./objects/addShape";
import { addDataField, getDataFieldsByDocumentType } from "./objects/addDataField";
import { addLineItemsTable } from "./objects/addLineItemsTable";

interface FabricToolboxProps {
  canvas: any;
  documentType: string;
}

export const FabricToolbox = ({ canvas, documentType }: FabricToolboxProps) => {
  const dataFields = getDataFieldsByDocumentType(documentType);

  const textElements = [
    { icon: Heading1, name: "Heading", onClick: () => addHeading(canvas) },
    { icon: Heading2, name: "Subheading", onClick: () => addSubheading(canvas) },
    { icon: Type, name: "Body Text", onClick: () => addBodyText(canvas) },
  ];

  const shapes = [
    { icon: Square, name: "Rectangle", onClick: () => addRectangle(canvas) },
    { icon: Circle, name: "Circle", onClick: () => addCircle(canvas) },
    { icon: Minus, name: "Line", onClick: () => addLine(canvas) },
  ];

  return (
    <div className="w-64 border-r border-border bg-background">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold">Elements</h2>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4 space-y-4">
          {/* Text */}
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Text</h3>
            <div className="space-y-1">
              {textElements.map((item) => (
                <Button
                  key={item.name}
                  onClick={item.onClick}
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Shapes */}
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Shapes</h3>
            <div className="space-y-1">
              {shapes.map((item) => (
                <Button
                  key={item.name}
                  onClick={item.onClick}
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Data Fields */}
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Data Fields</h3>
            <div className="space-y-1">
              {dataFields.map((field) => (
                <Button
                  key={field.field}
                  onClick={() => addDataField(canvas, field.field, field.label)}
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                >
                  <Database className="mr-2 h-4 w-4" />
                  {field.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Tables */}
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">Tables</h3>
            <div className="space-y-1">
              <Button
                onClick={() => addLineItemsTable(canvas, false)}
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <Table className="mr-2 h-4 w-4" />
                Line Items
              </Button>
              <Button
                onClick={() => addLineItemsTable(canvas, true)}
                variant="outline"
                className="w-full justify-start"
                size="sm"
              >
                <Table className="mr-2 h-4 w-4" />
                Line Items (with Sub-items)
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
