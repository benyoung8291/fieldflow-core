import { useNode } from "@craftjs/core";
import { useState } from "react";
import { Upload } from "lucide-react";

interface ImageBlockProps {
  src?: string;
  width?: number;
  height?: number;
  objectFit?: "contain" | "cover" | "fill";
  borderRadius?: number;
  opacity?: number;
}

export const ImageBlock = ({ 
  src,
  width = 200,
  height = 150,
  objectFit = "contain",
  borderRadius = 0,
  opacity = 1
}: ImageBlockProps) => {
  const { connectors: { connect, drag }, selected, hovered } = useNode((node) => ({
    selected: node.events.selected,
    hovered: node.events.hovered
  }));
  const [imageError, setImageError] = useState(false);
  
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        cursor: "move",
        position: "relative",
        overflow: "hidden",
        borderRadius: `${borderRadius}px`,
        opacity,
        outline: selected ? "2px solid hsl(var(--primary))" : hovered ? "1px dashed hsl(var(--primary) / 0.5)" : "none",
        outlineOffset: "2px",
        transition: "outline 0.2s"
      }}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt="Template image"
          style={{
            width: "100%",
            height: "100%",
            objectFit
          }}
          onError={() => setImageError(true)}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            border: "2px dashed hsl(var(--border))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "hsl(var(--muted))"
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Upload size={24} style={{ margin: "0 auto", color: "hsl(var(--muted-foreground))" }} />
            <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", marginTop: "8px" }}>
              Add Image
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

ImageBlock.craft = {
  displayName: "Image",
  props: {
    src: undefined,
    width: 200,
    height: 150,
    objectFit: "contain",
    borderRadius: 0,
    opacity: 1
  },
  rules: {
    canDrag: () => true,
  },
};