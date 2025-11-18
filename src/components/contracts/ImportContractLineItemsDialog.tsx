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

        // Auto-detect column mappings - create mapping for each system field
        const allFields = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS.filter(f => f.value !== "ignore")];
        const autoMappings: ColumnMapping[] = allFields.map((field) => {
          // Find best matching CSV column for this system field
          let matchingColumn = "";
          
          for (const header of headers) {
            const normalizedHeader = header.toLowerCase().replace(/[_\s]/g, "");
            
            if (field.value === "description" && (normalizedHeader.includes("description") || normalizedHeader.includes("item") || normalizedHeader.includes("scope"))) {
              matchingColumn = header;
              break;
            } else if (field.value === "quantity" && (normalizedHeader.includes("quantity") || normalizedHeader === "qty" || normalizedHeader === "q")) {
              matchingColumn = header;
              break;
            } else if (field.value === "unit_price" && (normalizedHeader.includes("price") || normalizedHeader.includes("cost") || normalizedHeader.includes("rate") || normalizedHeader.includes("unitprice"))) {
              matchingColumn = header;
              break;
            } else if (field.value === "estimated_hours" && (normalizedHeader.includes("hour") || normalizedHeader.includes("time") || normalizedHeader.includes("duration"))) {
              matchingColumn = header;
              break;
            } else if (field.value === "frequency" && (normalizedHeader.includes("frequency") || normalizedHeader.includes("recurrence") || normalizedHeader.includes("freq") || normalizedHeader.includes("schedule"))) {
              matchingColumn = header;
              break;
            } else if (field.value === "first_date" && (normalizedHeader.includes("firstdate") || normalizedHeader.includes("startdate") || normalizedHeader.includes("start") || normalizedHeader.includes("first"))) {
              matchingColumn = header;
              break;
            } else if (field.value === "next_date" && (normalizedHeader.includes("nextdate") || normalizedHeader.includes("next"))) {
              matchingColumn = header;
              break;
            } else if (field.value === "location_name" && (normalizedHeader.includes("locationname") || normalizedHeader === "location" || normalizedHeader.includes("site"))) {
              matchingColumn = header;
              break;
            } else if (field.value === "location_id" && normalizedHeader.includes("locationid")) {
              matchingColumn = header;
              break;
            } else if (field.value === "key_number" && (normalizedHeader.includes("key") || normalizedHeader.includes("keynumber"))) {
              matchingColumn = header;
              break;
            } else if (field.value === "line_total" && (normalizedHeader.includes("total") || normalizedHeader.includes("amount") || normalizedHeader.includes("linetotal"))) {
              matchingColumn = header;
              break;
            }
          }
          
          return { csvColumn: matchingColumn, targetField: field.value };
        });

        setColumnMappings(autoMappings);
        setStage("mapping");
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      },
    });
  };

  const updateMapping = (targetField: string, csvColumn: string) => {
    setColumnMappings((prev) =>
      prev.map((m) => (m.targetField === targetField ? { ...m, csvColumn } : m))
    );
  };

  const validateMappings = (): boolean => {
    const requiredFields = REQUIRED_FIELDS.map((f) => f.value);
    const unmappedRequired = columnMappings
      .filter((m) => requiredFields.includes(m.targetField) && (!m.csvColumn || m.csvColumn === "__none__"))
      .map((m) => {
        const field = REQUIRED_FIELDS.find((f) => f.value === m.targetField);
        return field?.label || m.targetField;
      });

    if (unmappedRequired.length > 0) {
      toast.error(`Please map all required fields: ${unmappedRequired.join(", ")}`);
      return false;
    }

    return true;
  };

  const parseDate = (dateValue: string, contractStartDate?: string): string => {
    if (!dateValue) return new Date().toISOString().split("T")[0];
    
    // Try parsing as standard date format first
    const standardDate = new Date(dateValue);
    if (!isNaN(standardDate.getTime())) {
      const parsed = standardDate.toISOString().split("T")[0];
      // If contract start date provided, ensure parsed date is not before it
      if (contractStartDate && parsed < contractStartDate) {
        return contractStartDate;
      }
      return parsed;
    }
    
    // Handle abbreviated month names (e.g., "Jul", "Aug")
    const monthMap: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    
    const normalizedValue = dateValue.toLowerCase().trim();
    const monthIndex = monthMap[normalizedValue];
    
    if (monthIndex !== undefined) {
      const currentYear = new Date().getFullYear();
      // Use UTC to avoid timezone shifts - format as YYYY-MM-DD
      const year = currentYear;
      const month = String(monthIndex + 1).padStart(2, '0');
      const day = '01';
      const parsed = `${year}-${month}-${day}`;
      
      // If contract start date provided, ensure parsed date is not before it
      if (contractStartDate && parsed < contractStartDate) {
        return contractStartDate;
      }
      return parsed;
    }
    
    // Fallback to current date if parsing fails
    const fallback = new Date().toISOString().split("T")[0];
    if (contractStartDate && fallback < contractStartDate) {
      return contractStartDate;
    }
    return fallback;
  };

  const parseFrequency = (frequencyValue: string): string => {
    if (!frequencyValue) return "monthly";
    
    // Handle values like "6 monthly", "12 monthly", "weekly", etc.
    const normalized = frequencyValue.toLowerCase().trim();
    
    // Check for specific patterns first (before generic ones)
    if (normalized.includes("6") && normalized.includes("month")) return "semi_annually";
    if (normalized.includes("six") && normalized.includes("month")) return "semi_annually";
    if (normalized.includes("semi") && normalized.includes("annual")) return "semi_annually";
    if (normalized.includes("fortnight") || normalized.includes("bi") && normalized.includes("week")) return "bi_weekly";
    
    // Then check generic patterns
    if (normalized.includes("month")) return "monthly";
    if (normalized.includes("week")) return "weekly";
    if (normalized.includes("year") || normalized.includes("annual")) return "annually";
    if (normalized.includes("day") || normalized.includes("daily")) return "daily";
    if (normalized.includes("quarter")) return "quarterly";
    
    // Default to the normalized value if it's already clean
    return normalized;
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

      // Fetch contract start date for validation
      const { data: contract } = await supabase
        .from("service_contracts")
        .select("start_date")
        .eq("id", contractId)
        .single();

      const contractStartDate = contract?.start_date;

      // Fetch customer locations for reference
      const { data: existingLocations } = await supabase
        .from("customer_locations")
        .select("id, name, customer_location_id")
        .eq("customer_id", customerId)
        .eq("is_active", true);

      // Process each row and create locations if needed
      const lineItems = [];
      
      for (let index = 0; index < parsedData.rows.length; index++) {
        const row = parsedData.rows[index];
        const mappedRow: any = {};
        
        columnMappings.forEach((mapping) => {
          if (mapping.csvColumn && mapping.csvColumn !== "__none__" && mapping.targetField) {
            mappedRow[mapping.targetField] = row[mapping.csvColumn];
          }
        });

        // Find or create location
        let locationId = null;
        
        if (mappedRow.location_name) {
          // Try to find existing location by name
          let location = existingLocations?.find(
            (loc) => loc.name.toLowerCase() === mappedRow.location_name.toLowerCase()
          );

          // If location doesn't exist, create it
          if (!location) {
            const { data: newLocation, error: locationError } = await supabase
              .from("customer_locations")
              .insert({
                tenant_id: profile.tenant_id,
                customer_id: customerId,
                name: mappedRow.location_name,
                is_active: true,
              })
              .select()
              .single();

            if (locationError) {
              console.error("Failed to create location:", locationError);
              toast.error(`Failed to create location: ${mappedRow.location_name}`);
              continue; // Skip this line item if location creation fails
            }

            location = newLocation;
            existingLocations?.push(newLocation); // Add to cache for subsequent rows
          }

          locationId = location.id;
        }

        // Format data for database - strip spaces and non-numeric chars from all numbers
        const quantity = parseFloat(String(mappedRow.quantity || "1").replace(/[^0-9.-]/g, "")) || 1;
        const unitPrice = parseFloat(String(mappedRow.unit_price || "0").replace(/[^0-9.-]/g, "")) || 0;
        const estimatedHours = parseFloat(String(mappedRow.estimated_hours || "0").replace(/[^0-9.-]/g, "")) || 0;
        
        const firstDate = parseDate(mappedRow.first_date, contractStartDate);
        const nextDate = mappedRow.next_date ? parseDate(mappedRow.next_date, contractStartDate) : firstDate;

        lineItems.push({
          contract_id: contractId,
          description: mappedRow.description || "",
          quantity,
          unit_price: unitPrice,
          line_total: mappedRow.line_total 
            ? parseFloat(String(mappedRow.line_total).replace(/[^0-9.-]/g, "")) 
            : quantity * unitPrice,
          estimated_hours: estimatedHours,
          recurrence_frequency: parseFrequency(mappedRow.frequency),
          first_generation_date: firstDate,
          next_generation_date: nextDate,
          location_id: locationId,
          key_number: mappedRow.key_number || null,
          is_active: true,
          item_order: index,
        });
      }

      if (lineItems.length === 0) {
        throw new Error("No valid line items to import");
      }

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
                    <TableHead className="w-[200px]">System Field</TableHead>
                    <TableHead className="w-[200px]">CSV Column</TableHead>
                    <TableHead>Preview Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REQUIRED_FIELDS.map((field) => {
                    const mapping = columnMappings.find((m) => m.targetField === field.value);
                    return (
                      <TableRow key={field.value}>
                        <TableCell className="font-medium">
                          {field.label}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping?.csvColumn || "__none__"}
                            onValueChange={(value) =>
                              updateMapping(field.value, value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select CSV column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">-- Not Mapped --</SelectItem>
                              {parsedData?.headers.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {mapping?.csvColumn && mapping.csvColumn !== "__none__" && parsedData?.rows
                            .slice(0, 5)
                            .map((row: any) => row[mapping.csvColumn])
                            .filter(Boolean)
                            .join(", ") || "(not mapped)"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {OPTIONAL_FIELDS.filter((f) => f.value !== "ignore").map((field) => {
                    const mapping = columnMappings.find((m) => m.targetField === field.value);
                    return (
                      <TableRow key={field.value}>
                        <TableCell className="font-medium text-muted-foreground">
                          {field.label}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping?.csvColumn || "__none__"}
                            onValueChange={(value) =>
                              updateMapping(field.value, value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select CSV column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">-- Not Mapped --</SelectItem>
                              {parsedData?.headers.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {mapping?.csvColumn && mapping.csvColumn !== "__none__" && parsedData?.rows
                            .slice(0, 5)
                            .map((row: any) => row[mapping.csvColumn])
                            .filter(Boolean)
                            .join(", ") || "(not mapped)"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
