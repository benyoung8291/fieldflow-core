import { useNode } from "@craftjs/core";

interface DataFieldProps {
  field?: string;
  label?: string;
  fontSize?: number;
  fontWeight?: number;
}

export const DataField = ({ 
  field = "customer.name",
  label = "Customer Name",
  fontSize = 14,
  fontWeight = 400
}: DataFieldProps) => {
  const { connectors: { connect, drag } } = useNode();
  
  return (
    <div
      ref={(ref) => ref && connect(drag(ref))}
      style={{
        padding: "8px",
        border: "1px dashed hsl(var(--border))",
        borderRadius: "4px",
        cursor: "move"
      }}
    >
      <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: `${fontSize}px`, fontWeight, fontFamily: "monospace" }}>
        {`{{${field}}}`}
      </div>
    </div>
  );
};

DataField.craft = {
  displayName: "Data Field",
  props: {
    field: "customer.name",
    label: "Customer Name",
    fontSize: 14,
    fontWeight: 400
  },
  rules: {
    canDrag: () => true,
  },
};