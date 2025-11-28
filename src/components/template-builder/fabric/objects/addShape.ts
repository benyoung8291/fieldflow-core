import { Rect, Circle, Line } from "fabric";

export const addRectangle = (canvas: any, options: {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
} = {}) => {
  const rect = new Rect({
    left: 100,
    top: 100,
    width: 150,
    height: 100,
    fill: options.fill || "rgba(0,0,0,0)",
    stroke: options.stroke || "#cccccc",
    strokeWidth: options.strokeWidth || 2,
  });

  canvas.add(rect);
  canvas.setActiveObject(rect);
  canvas.renderAll();
  
  return rect;
};

export const addCircle = (canvas: any, options: {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
} = {}) => {
  const circle = new Circle({
    left: 100,
    top: 100,
    radius: 50,
    fill: options.fill || "rgba(0,0,0,0)",
    stroke: options.stroke || "#cccccc",
    strokeWidth: options.strokeWidth || 2,
  });

  canvas.add(circle);
  canvas.setActiveObject(circle);
  canvas.renderAll();
  
  return circle;
};

export const addLine = (canvas: any, options: {
  stroke?: string;
  strokeWidth?: number;
} = {}) => {
  const line = new Line([50, 50, 200, 50], {
    stroke: options.stroke || "#cccccc",
    strokeWidth: options.strokeWidth || 2,
  });

  canvas.add(line);
  canvas.setActiveObject(line);
  canvas.renderAll();
  
  return line;
};
