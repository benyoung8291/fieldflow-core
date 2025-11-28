import { Textbox } from "fabric";

export const addText = (
  canvas: any,
  text: string = "Double-click to edit",
  options: {
    fontSize?: number;
    fontWeight?: string | number;
    fontFamily?: string;
    fill?: string;
    textAlign?: string;
  } = {}
) => {
  const textbox = new Textbox(text, {
    left: 100,
    top: 100,
    width: 200,
    fontSize: options.fontSize || 16,
    fontWeight: options.fontWeight || "normal",
    fontFamily: options.fontFamily || "Inter",
    fill: options.fill || "hsl(var(--foreground))",
    textAlign: (options.textAlign as any) || "left",
    editable: true,
  });

  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.renderAll();
  
  return textbox;
};

export const addHeading = (canvas: any) => {
  return addText(canvas, "Heading", {
    fontSize: 32,
    fontWeight: "bold",
  });
};

export const addSubheading = (canvas: any) => {
  return addText(canvas, "Subheading", {
    fontSize: 24,
    fontWeight: 600,
  });
};

export const addBodyText = (canvas: any) => {
  return addText(canvas, "Body text", {
    fontSize: 14,
  });
};
