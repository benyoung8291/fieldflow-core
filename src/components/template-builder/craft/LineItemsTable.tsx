import { useNode } from "@craftjs/core";

interface LineItemsTableProps {
  showQuantity?: boolean;
  showUnitPrice?: boolean;
  showLineTotal?: boolean;
  showDescription?: boolean;
}

export const LineItemsTable = ({
  showQuantity = true,
  showUnitPrice = true,
  showLineTotal = true,
  showDescription = true
}: LineItemsTableProps) => {
  const { connectors: { connect, drag }, selected, hovered } = useNode((node) => ({
    selected: node.events.selected,
    hovered: node.events.hovered
  }));
  
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{ 
        width: "100%", 
        cursor: "move",
        outline: selected ? "2px solid hsl(var(--primary))" : hovered ? "1px dashed hsl(var(--primary) / 0.5)" : "none",
        outlineOffset: "2px",
        transition: "outline 0.2s"
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid hsl(var(--border))" }}>
        <thead>
          <tr style={{ background: "hsl(var(--muted))" }}>
            {showDescription && <th style={{ padding: "8px", textAlign: "left", border: "1px solid hsl(var(--border))" }}>Description</th>}
            {showQuantity && <th style={{ padding: "8px", textAlign: "right", border: "1px solid hsl(var(--border))" }}>Qty</th>}
            {showUnitPrice && <th style={{ padding: "8px", textAlign: "right", border: "1px solid hsl(var(--border))" }}>Unit Price</th>}
            {showLineTotal && <th style={{ padding: "8px", textAlign: "right", border: "1px solid hsl(var(--border))" }}>Total</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            {showDescription && <td style={{ padding: "8px", border: "1px solid hsl(var(--border))" }}>{'{{line_items[].description}}'}</td>}
            {showQuantity && <td style={{ padding: "8px", textAlign: "right", border: "1px solid hsl(var(--border))" }}>{'{{line_items[].quantity}}'}</td>}
            {showUnitPrice && <td style={{ padding: "8px", textAlign: "right", border: "1px solid hsl(var(--border))" }}>{'{{line_items[].unit_price}}'}</td>}
            {showLineTotal && <td style={{ padding: "8px", textAlign: "right", border: "1px solid hsl(var(--border))" }}>{'{{line_items[].line_total}}'}</td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

LineItemsTable.craft = {
  displayName: "Line Items Table",
  props: {
    showQuantity: true,
    showUnitPrice: true,
    showLineTotal: true,
    showDescription: true
  },
  rules: {
    canDrag: () => true,
  },
};