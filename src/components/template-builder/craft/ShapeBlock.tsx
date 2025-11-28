import { useNode } from "@craftjs/core";

interface ShapeBlockProps {
  shape?: "rectangle" | "circle" | "line";
  width?: number;
  height?: number;
  background?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  opacity?: number;
}

export const ShapeBlock = ({ 
  shape = "rectangle",
  width = 100,
  height = 100,
  background = "#000000",
  borderRadius = 0,
  borderWidth = 0,
  borderColor = "#000000",
  opacity = 1
}: ShapeBlockProps) => {
  const { connectors: { connect, drag } } = useNode();
  
  const getShapeStyles = () => {
    const baseStyles = {
      background,
      opacity,
      border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : "none",
      cursor: "move"
    };

    switch (shape) {
      case "circle":
        return {
          ...baseStyles,
          width: `${width}px`,
          height: `${width}px`, // Force square for circle
          borderRadius: "50%"
        };
      case "line":
        return {
          ...baseStyles,
          width: `${width}px`,
          height: `${borderWidth || 2}px`,
          borderRadius: 0
        };
      case "rectangle":
      default:
        return {
          ...baseStyles,
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${borderRadius}px`
        };
    }
  };
  
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={getShapeStyles()}
    />
  );
};

ShapeBlock.craft = {
  displayName: "Shape",
  props: {
    shape: "rectangle",
    width: 100,
    height: 100,
    background: "#000000",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "#000000",
    opacity: 1
  },
  rules: {
    canDrag: () => true,
  },
};