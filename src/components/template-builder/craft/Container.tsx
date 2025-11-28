import { useNode } from "@craftjs/core";
import { ReactNode } from "react";

interface ContainerProps {
  children?: ReactNode;
  padding?: number;
  background?: string;
  flexDirection?: "row" | "column";
  gap?: number;
  position?: "relative" | "absolute";
  x?: number;
  y?: number;
  width?: number | "auto";
  height?: number | "auto";
}

export const Container = ({ 
  children, 
  padding = 16, 
  background = "transparent",
  flexDirection = "column",
  gap = 8,
  position = "relative",
  x = 0,
  y = 0,
  width = "auto",
  height = "auto"
}: ContainerProps) => {
  const { connectors: { connect, drag }, selected, hovered } = useNode((node) => ({
    selected: node.events.selected,
    hovered: node.events.hovered
  }));
  
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        padding: `${padding}px`,
        background,
        display: "flex",
        flexDirection,
        gap: `${gap}px`,
        minHeight: position === "absolute" ? (height === "auto" ? "50px" : `${height}px`) : "50px",
        width: position === "absolute" ? (width === "auto" ? "200px" : `${width}px`) : "100%",
        position,
        ...(position === "absolute" && {
          left: `${x}px`,
          top: `${y}px`,
        }),
        outline: selected ? "2px solid hsl(var(--primary))" : hovered ? "1px dashed hsl(var(--primary) / 0.5)" : "none",
        outlineOffset: "2px",
        transition: "outline 0.2s"
      }}
    >
      {children}
    </div>
  );
};

Container.craft = {
  displayName: "Container",
  props: {
    padding: 16,
    background: "transparent",
    flexDirection: "column",
    gap: 8,
    position: "relative",
    x: 0,
    y: 0,
    width: "auto",
    height: "auto"
  },
  rules: {
    canDrag: () => true,
  },
};