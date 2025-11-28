import { useNode } from "@craftjs/core";

interface TextBlockProps {
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
}

export const TextBlock = ({ 
  text = "Edit this text", 
  fontSize = 14,
  fontWeight = 400,
  color = "#000000",
  textAlign = "left"
}: TextBlockProps) => {
  const { connectors: { connect, drag } } = useNode();
  
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        fontSize: `${fontSize}px`,
        fontWeight,
        color,
        textAlign,
        padding: "4px",
        cursor: "move"
      }}
    >
      {text}
    </div>
  );
};

TextBlock.craft = {
  displayName: "Text",
  props: {
    text: "Edit this text",
    fontSize: 14,
    fontWeight: 400,
    color: "#000000",
    textAlign: "left"
  },
  rules: {
    canDrag: () => true,
  },
};