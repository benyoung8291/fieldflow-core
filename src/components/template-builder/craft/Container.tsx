import { useNode } from "@craftjs/core";
import { ReactNode } from "react";

interface ContainerProps {
  children?: ReactNode;
  padding?: number;
  background?: string;
  flexDirection?: "row" | "column";
  gap?: number;
}

export const Container = ({ 
  children, 
  padding = 16, 
  background = "transparent",
  flexDirection = "column",
  gap = 8
}: ContainerProps) => {
  const { connectors: { connect, drag } } = useNode();
  
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        padding: `${padding}px`,
        background,
        display: "flex",
        flexDirection,
        gap: `${gap}px`,
        minHeight: "50px",
        width: "100%"
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
    gap: 8
  },
  rules: {
    canDrag: () => true,
  },
};