import { Group, Rect, Textbox, Line } from "fabric";

export const addLineItemsTable = (canvas: any) => {
  const tableWidth = 500;
  const rowHeight = 30;
  const headerHeight = 35;
  const numRows = 5;

  // Background
  const background = new Rect({
    width: tableWidth,
    height: headerHeight + (rowHeight * numRows),
    fill: "hsl(var(--background))",
    stroke: "hsl(var(--border))",
    strokeWidth: 1,
  });

  // Header background
  const headerBg = new Rect({
    width: tableWidth,
    height: headerHeight,
    fill: "hsl(var(--muted))",
  });

  // Column widths
  const descWidth = tableWidth * 0.4;
  const qtyWidth = tableWidth * 0.15;
  const priceWidth = tableWidth * 0.2;
  const totalWidth = tableWidth * 0.25;

  // Headers
  const headers = [
    { text: "Description", x: descWidth / 2 },
    { text: "Qty", x: descWidth + qtyWidth / 2 },
    { text: "Unit Price", x: descWidth + qtyWidth + priceWidth / 2 },
    { text: "Total", x: descWidth + qtyWidth + priceWidth + totalWidth / 2 },
  ];

  const headerTexts = headers.map(h => new Textbox(h.text, {
    left: h.x,
    top: headerHeight / 2,
    width: 100,
    fontSize: 12,
    fontWeight: "bold",
    fill: "hsl(var(--foreground))",
    textAlign: "center",
    originX: "center",
    originY: "center",
    editable: false,
  }));

  // Vertical lines
  const vLines = [
    new Line([descWidth, 0, descWidth, headerHeight + (rowHeight * numRows)], {
      stroke: "hsl(var(--border))",
      strokeWidth: 1,
    }),
    new Line([descWidth + qtyWidth, 0, descWidth + qtyWidth, headerHeight + (rowHeight * numRows)], {
      stroke: "hsl(var(--border))",
      strokeWidth: 1,
    }),
    new Line([descWidth + qtyWidth + priceWidth, 0, descWidth + qtyWidth + priceWidth, headerHeight + (rowHeight * numRows)], {
      stroke: "hsl(var(--border))",
      strokeWidth: 1,
    }),
  ];

  // Horizontal line under header
  const headerLine = new Line([0, headerHeight, tableWidth, headerHeight], {
    stroke: "hsl(var(--border))",
    strokeWidth: 2,
  });

  // Row lines
  const rowLines = Array.from({ length: numRows - 1 }, (_, i) => 
    new Line([0, headerHeight + rowHeight * (i + 1), tableWidth, headerHeight + rowHeight * (i + 1)], {
      stroke: "hsl(var(--border))",
      strokeWidth: 1,
    })
  );

  // Placeholder data
  const rowTexts: any[] = [];
  for (let i = 0; i < numRows; i++) {
    const y = headerHeight + rowHeight * i + rowHeight / 2;
    rowTexts.push(
      new Textbox(`{{line_items[${i}].description}}`, {
        left: descWidth / 2,
        top: y,
        width: descWidth - 10,
        fontSize: 11,
        fontFamily: "monospace",
        fill: "hsl(var(--muted-foreground))",
        textAlign: "left",
        originX: "center",
        originY: "center",
        editable: false,
      }),
      new Textbox(`{{line_items[${i}].quantity}}`, {
        left: descWidth + qtyWidth / 2,
        top: y,
        width: qtyWidth - 10,
        fontSize: 11,
        fontFamily: "monospace",
        fill: "hsl(var(--muted-foreground))",
        textAlign: "center",
        originX: "center",
        originY: "center",
        editable: false,
      }),
      new Textbox(`{{line_items[${i}].unit_price}}`, {
        left: descWidth + qtyWidth + priceWidth / 2,
        top: y,
        width: priceWidth - 10,
        fontSize: 11,
        fontFamily: "monospace",
        fill: "hsl(var(--muted-foreground))",
        textAlign: "center",
        originX: "center",
        originY: "center",
        editable: false,
      }),
      new Textbox(`{{line_items[${i}].line_total}}`, {
        left: descWidth + qtyWidth + priceWidth + totalWidth / 2,
        top: y,
        width: totalWidth - 10,
        fontSize: 11,
        fontFamily: "monospace",
        fill: "hsl(var(--muted-foreground))",
        textAlign: "center",
        originX: "center",
        originY: "center",
        editable: false,
      })
    );
  }

  const group = new Group([
    background,
    headerBg,
    ...vLines,
    headerLine,
    ...rowLines,
    ...headerTexts,
    ...rowTexts,
  ], {
    left: 50,
    top: 200,
    customType: "lineItemsTable",
  } as any);

  canvas.add(group);
  canvas.setActiveObject(group);
  canvas.renderAll();
  
  return group;
};
