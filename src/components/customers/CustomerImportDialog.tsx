import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { Upload, FileText, Loader2, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CustomerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing";

const CUSTOMER_FIELDS = [
  { value: "name", label: "Name *", required: true },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "address", label: "Address" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "postcode", label: "Postcode" },
  { value: "abn", label: "ABN" },
  { value: "trading_name", label: "Trading Name" },
  { value: "legal_company_name", label: "Legal Company Name" },
  { value: "billing_address", label: "Billing Address" },
  { value: "billing_phone", label: "Billing Phone" },
  { value: "billing_email", label: "Billing Email" },
  { value: "payment_terms", label: "Payment Terms (days)" },
  { value: "notes", label: "Notes" },
  { value: "_skip", label: "- Skip this column -" },
];

export default function CustomerImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: CustomerImportDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          toast({
            title: "Empty file",
            description: "The CSV file contains no data",
            variant: "destructive",
          });
          return;
        }

        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data);

        // Auto-map columns with matching names
        const autoMapping: Record<string, string> = {};
        headers.forEach((header) => {
          const normalizedHeader = header.toLowerCase().trim().replace(/\s+/g, "_");
          const matchingField = CUSTOMER_FIELDS.find(
            (f) => f.value === normalizedHeader || f.label.toLowerCase() === header.toLowerCase()
          );
          if (matchingField && matchingField.value !== "_skip") {
            autoMapping[header] = matchingField.value;
          }
        });
        setColumnMapping(autoMapping);
        setStep("mapping");

        toast({
          title: "File uploaded",
          description: `Found ${results.data.length} rows`,
        });
      },
      error: (error) => {
        toast({
          title: "Parse error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleColumnMappingChange = (csvColumn: string, dbField: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [csvColumn]: dbField,
    }));
  };

  const getMappedData = () => {
    return csvData.map((row) => {
      const mappedRow: any = {};
      Object.entries(columnMapping).forEach(([csvCol, dbField]) => {
        if (dbField !== "_skip" && row[csvCol] !== undefined) {
          let value = row[csvCol];
          // Convert payment_terms to number if present
          if (dbField === "payment_terms" && value) {
            value = parseInt(value, 10);
            if (isNaN(value)) value = 30; // Default to 30 days
          }
          mappedRow[dbField] = value;
        }
      });
      return mappedRow;
    });
  };

  const validateMappedData = () => {
    const hasNameMapping = Object.values(columnMapping).includes("name");
    if (!hasNameMapping) {
      toast({
        title: "Missing required field",
        description: "You must map the 'Name' field",
        variant: "destructive",
      });
      return false;
    }

    const mappedData = getMappedData();
    const invalidRows = mappedData.filter((row) => !row.name || row.name.trim() === "");
    if (invalidRows.length > 0) {
      toast({
        title: "Invalid data",
        description: `${invalidRows.length} rows are missing the required 'Name' field`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handlePreview = () => {
    if (!validateMappedData()) return;
    setStep("preview");
  };

  const handleImport = async () => {
    setImporting(true);
    setStep("importing");

    try {
      // Get current user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const mappedData = getMappedData();
      const customersToInsert = mappedData.map((row) => ({
        ...row,
        tenant_id: profile.tenant_id,
        is_active: true,
      }));

      const { error } = await supabase
        .from("customers")
        .insert(customersToInsert);

      if (error) throw error;

      toast({
        title: "Import successful",
        description: `Successfully imported ${customersToInsert.length} customers`,
      });

      onImportComplete();
      handleClose();
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    onOpenChange(false);
  };

  const previewData = getMappedData().slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Customers from CSV</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload your CSV file to begin"}
            {step === "mapping" && "Map CSV columns to customer fields"}
            {step === "preview" && "Review your data before importing"}
            {step === "importing" && "Importing customers..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={step === "upload" ? "default" : "secondary"}>1. Upload</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step === "mapping" ? "default" : "secondary"}>2. Map</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step === "preview" ? "default" : "secondary"}>3. Preview</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step === "importing" ? "default" : "secondary"}>4. Import</Badge>
          </div>

          {/* Upload Step */}
          {step === "upload" && (
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <div className="text-lg font-medium mb-2">Click to upload CSV</div>
                <div className="text-sm text-muted-foreground mb-4">
                  or drag and drop your file here
                </div>
                <Button type="button" variant="outline">
                  Choose File
                </Button>
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Mapping Step */}
          {step === "mapping" && (
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    {csvData.length} rows found
                  </span>
                </div>
                {csvHeaders.map((header) => (
                  <div key={header} className="grid grid-cols-2 gap-4 items-center">
                    <div>
                      <Label className="text-muted-foreground">CSV Column</Label>
                      <div className="font-medium mt-1">{header}</div>
                    </div>
                    <div>
                      <Label>Maps to</Label>
                      <Select
                        value={columnMapping[header] || "_skip"}
                        onValueChange={(value) => handleColumnMappingChange(header, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CUSTOMER_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Preview Step */}
          {step === "preview" && (
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground mb-4">
                  Showing first 5 rows (importing {csvData.length} total)
                </div>
                <div className="space-y-4">
                  {previewData.map((row, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2">
                      {Object.entries(row).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-2 gap-2 text-sm">
                          <span className="font-medium capitalize">
                            {key.replace(/_/g, " ")}:
                          </span>
                          <span className="text-muted-foreground">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Importing Step */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <div className="text-lg font-medium">Importing customers...</div>
              <div className="text-sm text-muted-foreground">Please wait</div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={handlePreview}>
                Next: Preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                Import {csvData.length} Customers
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
