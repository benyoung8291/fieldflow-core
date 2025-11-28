import { useEditor, Element } from "@craftjs/core";
import { Container } from "./craft/Container";
import { RichTextBlock } from "./craft/RichTextBlock";
import { ImageBlock } from "./craft/ImageBlock";
import { ShapeBlock } from "./craft/ShapeBlock";
import { DataField } from "./craft/DataField";
import { GradientBackground } from "./craft/GradientBackground";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";

export const PreBuiltBlocks = () => {
  const { connectors } = useEditor();

  const blocks = [
    {
      name: "Professional Header",
      preview: (
        <div className="h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded flex items-center px-4 text-white text-xs">
          Logo + Company Info
        </div>
      ),
      component: (
        <Element is={Container} canvas background="#ffffff" padding={24} flexDirection="row" gap={16}>
          <ImageBlock width={120} height={50} />
          <Element is={Container} canvas padding={0} gap={4}>
            <RichTextBlock text="Your Company Name" fontSize={20} fontWeight={700} />
            <RichTextBlock text="contact@company.com | (555) 123-4567" fontSize={12} color="#666666" />
          </Element>
        </Element>
      )
    },
    {
      name: "Hero Banner",
      preview: (
        <div className="h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded flex items-center justify-center text-white text-xs font-bold">
          QUOTATION
        </div>
      ),
      component: (
        <Element is={GradientBackground} canvas gradientFrom="#9333ea" gradientTo="#ec4899" padding={48}>
          <RichTextBlock text="QUOTATION" fontSize={48} fontWeight={700} textAlign="center" color="#ffffff" />
          <DataField field="quote_number" label="Quote Number" fontSize={18} />
        </Element>
      )
    },
    {
      name: "Customer Info Block",
      preview: (
        <div className="h-16 bg-gray-100 rounded p-2 text-xs">
          <div className="font-semibold">Bill To:</div>
          <div className="text-gray-600">Customer details...</div>
        </div>
      ),
      component: (
        <Element is={Container} canvas background="#f8f9fa" padding={20} gap={8}>
          <RichTextBlock text="Bill To:" fontSize={14} fontWeight={600} />
          <DataField field="customer.name" label="Customer Name" />
          <DataField field="customer.address" label="Address" />
          <DataField field="customer.phone" label="Phone" />
        </Element>
      )
    },
    {
      name: "Two Column Layout",
      preview: (
        <div className="h-16 grid grid-cols-2 gap-2">
          <div className="bg-gray-100 rounded" />
          <div className="bg-gray-100 rounded" />
        </div>
      ),
      component: (
        <Element is={Container} canvas flexDirection="row" gap={16} padding={16}>
          <Element is={Container} canvas padding={16} background="#f8f9fa">
            <RichTextBlock text="Left Column" fontSize={16} fontWeight={600} />
          </Element>
          <Element is={Container} canvas padding={16} background="#f8f9fa">
            <RichTextBlock text="Right Column" fontSize={16} fontWeight={600} />
          </Element>
        </Element>
      )
    },
    {
      name: "Footer Block",
      preview: (
        <div className="h-16 bg-gray-800 rounded flex items-center justify-center text-white text-xs">
          Terms & Contact
        </div>
      ),
      component: (
        <Element is={Container} canvas background="#1f2937" padding={24}>
          <RichTextBlock text="Terms & Conditions" fontSize={12} fontWeight={600} color="#ffffff" />
          <RichTextBlock text="Payment due within 30 days. All work guaranteed." fontSize={10} color="#d1d5db" />
        </Element>
      )
    }
  ];

  return (
    <div className="border-t border-border">
      <div className="p-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Pre-built Blocks</h3>
      </div>
      <ScrollArea className="h-64">
        <div className="px-4 pb-4 space-y-2">
          {blocks.map((block) => (
            <div key={block.name} className="space-y-1">
              <p className="text-xs font-medium">{block.name}</p>
              <Button
                ref={(ref) => ref && connectors.create(ref, block.component)}
                variant="outline"
                className="w-full h-20 p-2"
              >
                {block.preview}
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};