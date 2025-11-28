import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PlaceholderMappingListProps {
  placeholders: string[];
  documentType: string;
  mappings: Record<string, string>;
  onChange: (mappings: Record<string, string>) => void;
}

const FIELD_OPTIONS = {
  quote: {
    "Quote Details": [
      { value: "quote_number", label: "Quote Number" },
      { value: "created_at", label: "Quote Date" },
      { value: "valid_until", label: "Valid Until" },
      { value: "title", label: "Title" },
      { value: "description", label: "Description" },
      { value: "status", label: "Status" },
      { value: "customer_message", label: "Customer Message" },
    ],
    "Customer": [
      { value: "customer.name", label: "Customer Name" },
      { value: "customer.email", label: "Customer Email" },
      { value: "customer.phone", label: "Customer Phone" },
      { value: "customer.address", label: "Customer Address" },
      { value: "customer.city", label: "Customer City" },
      { value: "customer.state", label: "Customer State" },
      { value: "customer.postcode", label: "Customer Postcode" },
      { value: "customer.abn", label: "Customer ABN" },
    ],
    "Customer Location": [
      { value: "location.name", label: "Location Name" },
      { value: "location.address", label: "Location Address" },
      { value: "location.city", label: "Location City" },
      { value: "location.state", label: "Location State" },
      { value: "location.postcode", label: "Location Postcode" },
    ],
    "Contact": [
      { value: "contact.first_name", label: "Contact First Name" },
      { value: "contact.last_name", label: "Contact Last Name" },
      { value: "contact.email", label: "Contact Email" },
      { value: "contact.phone", label: "Contact Phone" },
    ],
    "Financials": [
      { value: "subtotal", label: "Subtotal" },
      { value: "tax_rate", label: "Tax Rate" },
      { value: "tax_amount", label: "Tax Amount" },
      { value: "total_amount", label: "Total Amount" },
    ],
    "Notes": [
      { value: "notes", label: "Notes" },
      { value: "terms_conditions", label: "Terms & Conditions" },
      { value: "internal_notes", label: "Internal Notes" },
    ],
    "Prepared By": [
      { value: "profile.first_name", label: "First Name" },
      { value: "profile.last_name", label: "Last Name" },
      { value: "profile.email", label: "Email" },
    ],
    "Line Items": [
      { value: "line_item.description", label: "Description" },
      { value: "line_item.quantity", label: "Quantity" },
      { value: "line_item.unit_price", label: "Unit Price" },
      { value: "line_item.line_total", label: "Line Total" },
      { value: "line_item.cost_price", label: "Cost Price" },
      { value: "line_item.margin_percentage", label: "Margin %" },
    ],
  },
  purchase_order: {
    "PO Details": [
      { value: "po_number", label: "PO Number" },
      { value: "po_date", label: "PO Date" },
      { value: "expected_delivery_date", label: "Expected Delivery Date" },
      { value: "status", label: "Status" },
      { value: "payment_terms", label: "Payment Terms (days)" },
    ],
    "Supplier": [
      { value: "supplier.name", label: "Supplier Name" },
      { value: "supplier.email", label: "Supplier Email" },
      { value: "supplier.phone", label: "Supplier Phone" },
      { value: "supplier.address", label: "Supplier Address" },
      { value: "supplier.city", label: "Supplier City" },
      { value: "supplier.state", label: "Supplier State" },
      { value: "supplier.abn", label: "Supplier ABN" },
    ],
    "Financials": [
      { value: "subtotal", label: "Subtotal" },
      { value: "tax_rate", label: "Tax Rate" },
      { value: "tax_amount", label: "Tax Amount" },
      { value: "total_amount", label: "Total Amount" },
    ],
    "Notes": [
      { value: "notes", label: "Notes" },
      { value: "internal_notes", label: "Internal Notes" },
    ],
    "Line Items": [
      { value: "line_item.description", label: "Description" },
      { value: "line_item.quantity", label: "Quantity" },
      { value: "line_item.unit_price", label: "Unit Price" },
      { value: "line_item.line_total", label: "Line Total" },
    ],
  },
  invoice: {
    "Invoice Details": [
      { value: "invoice_number", label: "Invoice Number" },
      { value: "invoice_date", label: "Invoice Date" },
      { value: "due_date", label: "Due Date" },
      { value: "status", label: "Status" },
    ],
    "Customer": [
      { value: "customer.name", label: "Customer Name" },
      { value: "customer.email", label: "Customer Email" },
      { value: "customer.phone", label: "Customer Phone" },
      { value: "customer.address", label: "Customer Address" },
      { value: "customer.city", label: "Customer City" },
      { value: "customer.state", label: "Customer State" },
      { value: "customer.postcode", label: "Customer Postcode" },
    ],
    "Financials": [
      { value: "subtotal", label: "Subtotal" },
      { value: "tax_rate", label: "Tax Rate" },
      { value: "tax_amount", label: "Tax Amount" },
      { value: "total_amount", label: "Total Amount" },
    ],
    "Notes": [
      { value: "notes", label: "Notes" },
    ],
    "Line Items": [
      { value: "line_item.description", label: "Description" },
      { value: "line_item.quantity", label: "Quantity" },
      { value: "line_item.unit_price", label: "Unit Price" },
      { value: "line_item.line_total", label: "Line Total" },
    ],
  },
};

export default function PlaceholderMappingList({ 
  placeholders, 
  documentType, 
  mappings, 
  onChange 
}: PlaceholderMappingListProps) {
  const fieldOptions = FIELD_OPTIONS[documentType as keyof typeof FIELD_OPTIONS] || FIELD_OPTIONS.quote;

  const handleMappingChange = (placeholder: string, value: string) => {
    onChange({
      ...mappings,
      [placeholder]: value,
    });
  };

  return (
    <ScrollArea className="h-[400px] border rounded-md p-4">
      <div className="space-y-4">
        {placeholders.map((placeholder) => {
          // Handle loop sections specially
          if (placeholder.startsWith('LOOP:')) {
            const loopName = placeholder.replace('LOOP:', '');
            return (
              <div key={placeholder} className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                <div className="flex items-start gap-2">
                  <div className="text-primary font-medium">
                    Repeating Section: {loopName}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  This section will repeat for each line item. Use placeholders inside the [[SG:{loopName}]] and [[EG:{loopName}]] markers with line_item.* fields.
                </p>
              </div>
            );
          }

          // Regular placeholder mapping
          return (
            <div key={placeholder} className="grid grid-cols-2 gap-4 items-center">
              <div>
                <Label className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {`{{${placeholder}}}`}
                </Label>
              </div>
              <Select
                value={mappings[placeholder] || ""}
                onValueChange={(value) => handleMappingChange(placeholder, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(fieldOptions).map(([category, fields]) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{category}</SelectLabel>
                      {fields.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
