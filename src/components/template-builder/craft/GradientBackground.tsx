import { useNode } from "@craftjs/core";
import { ReactNode } from "react";

interface GradientBackgroundProps {
  children?: ReactNode;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: number;
  padding?: number;
}

export const GradientBackground = ({ 
  children,
  gradientFrom = "#667eea",
  gradientTo = "#764ba2",
  gradientDirection = 135,
  padding = 32
}: GradientBackgroundProps) => {
  const { connectors: { connect, drag } } = useNode();
  
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        background: `linear-gradient(${gradientDirection}deg, ${gradientFrom}, ${gradientTo})`,
        padding: `${padding}px`,
        minHeight: "100px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}
    >
      {children}
    </div>
  );
};

GradientBackground.craft = {
  displayName: "Gradient Section",
  props: {
    gradientFrom: "#667eea",
    gradientTo: "#764ba2",
    gradientDirection: 135,
    padding: 32
  },
  rules: {
    canDrag: () => true,
  },
};