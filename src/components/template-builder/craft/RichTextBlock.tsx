import { useNode } from "@craftjs/core";

interface RichTextBlockProps {
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration?: "none" | "underline" | "line-through";
}

export const RichTextBlock = ({ 
  text = "Edit this text", 
  fontSize = 16,
  fontWeight = 400,
  fontFamily = "inherit",
  color = "#000000",
  textAlign = "left",
  lineHeight = 1.5,
  letterSpacing = 0,
  textTransform = "none",
  textDecoration = "none"
}: RichTextBlockProps) => {
  const { connectors: { connect, drag } } = useNode();
  
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      contentEditable
      suppressContentEditableWarning
      style={{
        fontSize: `${fontSize}px`,
        fontWeight,
        fontFamily,
        color,
        textAlign,
        lineHeight,
        letterSpacing: `${letterSpacing}px`,
        textTransform,
        textDecoration,
        padding: "8px",
        cursor: "move",
        outline: "none"
      }}
    >
      {text}
    </div>
  );
};

RichTextBlock.craft = {
  displayName: "Rich Text",
  props: {
    text: "Edit this text",
    fontSize: 16,
    fontWeight: 400,
    fontFamily: "inherit",
    color: "#000000",
    textAlign: "left",
    lineHeight: 1.5,
    letterSpacing: 0,
    textTransform: "none",
    textDecoration: "none"
  },
  rules: {
    canDrag: () => true,
  },
};