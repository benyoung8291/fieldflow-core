import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ImportContractLineItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  customerId: string;
}

interface ColumnMapping {
  csvColumn: string;
  targetField: string;
}

interface ParsedData {
  headers: string[];
  rows: any[];
}

const REQUIRED_FIELDS = [
  { value: "description", label: "Description *" },
  { value: "quantity", label: "Quantity *" },
  { value: "unit_price", label: "Unit Price *" },
  { value: "estimated_hours", label: "Estimated Hours *" },
  { value: "frequency", label: "Frequency *" },
  { value: "first_date", label: "First Generation Date *" },
  { value: "location_name", label: "Location Name *" },
];

const OPTIONAL_FIELDS = [
  { value: "line_total", label: "Line Total" },
  { value: "next_date", label: "Next Generation Date" },
  { value: "location_id", label: "Location ID" },
  { value: "key_number", label: "Key Number" },
  { value: "ignore", label: "-- Ignore Column --" },
];

export default function ImportContractLineItemsDialog({
  open,
  onOpenChange,
  contractId,
  customerId,
}: ImportContractLineItemsDialogProps) {
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"upload" | "mapping">("upload");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleParseFile = () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data;

        setParsedData({ headers, rows });

        // Auto-detect column mappings based on header names
        const autoMappings: ColumnMapping[] = headers.map((header) => {
          const normalizedHeader = header.toLowerCase().replace(/[_\s]/g, "");
          
          let targetField = "ignore";
          
          if (normalizedHeader.includes("description") || normalizedHeader.includes("item")) {
            targetField = "description";
          } else if (normalizedHeader.includes("quantity") || normalizedHeader === "qty") {
            targetField = "quantity";
          } else if (normalizedHeader.includes("price") || normalizedHeader.includes("cost")) {
            targetField = "unit_price";
          } else if (normalizedHeader.includes("hour") || normalizedHeader.includes("time")) {
            targetField = "estimated_hours";
          } else if (normalizedHeader.includes("frequency") || normalizedHeader.includes("recurrence")) {
            targetField = "frequency";
          } else if (normalizedHeader.includes("firstdate") || normalizedHeader.includes("startdate")) {
            targetField = "first_date";
          } else if (normalizedHeader.includes("nextdate")) {
            targetField = "next_date";
          } else if (normalizedHeader.includes("locationname") || normalizedHeader === "location") {
            targetField = "location_name";
          } else if (normalizedHeader.includes("locationid")) {
            targetField = "location_id";
          } else if (normalizedHeader.includes("key") || normalizedHeader.includes("keynumber")) {
            targetField = "key_number";
          } else if (normalizedHeader.includes("total") || normalizedHeader.includes("amount")) {
            targetField = "line_total";
          }

          return { csvColumn: header, targetField };
        });

        setColumnMappings(autoMappings);
        setStage("mapping");
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      },
    });
  };

  const updateMapping = (csvColumn: string, targetField: string) => {
    setColumnMappings((prev) =>
      prev.map((m) => (m.csvColumn === csvColumn ? { ...m, targetField } : m))
    );
  };

  const validateMappings = (): boolean => {
    const mappedFields = columnMappings
      .filter((m) => m.targetField !== "ignore")
      .map((m) => m.targetField);

    const requiredFields = REQUIRED_FIELDS.map((f) => f.value);
    const missingFields = requiredFields.filter((f) => !mappedFields.includes(f));

    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.join(", ")}`);
      return false;
    }

    return true;
  };

  const handleImport = async () => {
    if (!validateMappings() || !parsedData) {
      return;
    }

    setIsImporting(true);

    try {
      const { data: tenantData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", tenantData.user?.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant not found");

      // Fetch customer locations for reference
      const { data: locations } = await supabase
        .from("customer_locations")
        .select("id, name, customer_location_id")
        .eq("customer_id", customerId);

      // Transform CSV rows to line items using mappings
      const lineItems = parsedData.rows.map((row: any, index: number) => {
        const mappedRow: any = {};
        
        columnMappings.forEach((mapping) => {
          if (mapping.targetField !== "ignore") {
            mappedRow[mapping.targetField] = row[mapping.csvColumn];
          }
        });

        // Find location by name or customer_location_id
        const location = locations?.find(
          (loc) =>
            loc.name === mappedRow.location_name ||
            loc.customer_location_id === mappedRow.location_id
        );

        // Format data for database
        const quantity = parseFloat(mappedRow.quantity) || 1;
        const unitPrice = parseFloat(mappedRow.unit_price) || 0;
        
        return {
          tenant_id: profile.tenant_id,
          contract_id: contractId,
          description: mappedRow.description || "",
          quantity,
          unit_price: unitPrice,
          line_total: mappedRow.line_total 
            ? parseFloat(mappedRow.line_total) 
            : quantity * unitPrice,
          estimated_hours: parseFloat(mappedRow.estimated_hours) || 0,
          recurrence_frequency: mappedRow.frequency?.toLowerCase() || "monthly",
          first_generation_date: mappedRow.first_date || new Date().toISOString().split("T")[0],
          next_generation_date: 
            mappedRow.next_date || 
            mappedRow.first_date || 
            new Date().toISOString().split("T")[0],
          location_id: location?.id || null,
          key_number: mappedRow.key_number || null,
          is_active: true,
          item_order: index,
        };
      });

      const { error } = await supabase
        .from("service_contract_line_items")
        .insert(lineItems);

      if (error) throw error;

      toast.success(`Imported ${lineItems.length} line items successfully`);
      queryClient.invalidateQueries({ queryKey: ["service-contract", contractId] });
      handleClose();
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setParsedData(null);
    setColumnMappings([]);
    setStage("upload");
    onOpenChange(false);
  };

  const handleBack = () => {
    setStage("upload");
    setParsedData(null);
    setColumnMappings([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Contract Line Items from CSV
          </DialogTitle>
          <DialogDescription>
            {stage === "upload" 
              ? "Upload a CSV file containing contract line items" 
              : "Review and adjust column mappings"}
          </DialogDescription>
        </DialogHeader>

        {stage === "upload" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">Select CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Required CSV Columns:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Description</li>
                <li>Quantity</li>
                <li>Unit Price</li>
                <li>Estimated Hours</li>
                <li>Frequency (e.g., monthly, weekly, annually)</li>
                <li>First Generation Date (YYYY-MM-DD)</li>
                <li>Location Name (must match existing location)</li>
              </ul>
              <p className="text-sm font-medium mt-3">Optional Columns:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Line Total</li>
                <li>Next Generation Date</li>
                <li>Location ID (customer location ID)</li>
                <li>Key Number</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                disabled={isImporting}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <p className="text-sm text-muted-foreground">
                Map CSV columns to line item fields. Preview shows first 5 rows.
              </p>
            </div>

            <ScrollArea className="flex-1 border rounded-lg min-h-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">CSV Column</TableHead>
                    <TableHead className="w-[200px]">Maps To</TableHead>
                    <TableHead>Preview Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMappings.map((mapping) => (
                    <TableRow key={mapping.csvColumn}>
                      <TableCell className="font-medium">
                        {mapping.csvColumn}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping.targetField}
                          onValueChange={(value) =>
                            updateMapping(mapping.csvColumn, value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REQUIRED_FIELDS.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                            {OPTIONAL_FIELDS.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {parsedData?.rows
                          .slice(0, 5)
                          .map((row: any) => row[mapping.csvColumn])
                          .filter(Boolean)
                          .join(", ") || "(empty)"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {parsedData && (
              <p className="text-sm text-muted-foreground">
                Total rows to import: {parsedData.rows.length}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          {stage === "upload" ? (
            <Button onClick={handleParseFile} disabled={!selectedFile}>
              Next: Review Mappings
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Line Items
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
