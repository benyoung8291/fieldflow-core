import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Upload, Download } from "lucide-react";
import Papa from "papaparse";
import { useQueryClient } from "@tanstack/react-query";

interface SupplierImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface DuplicateMatch {
  row: number;
  existingSupplier: any;
  importData: any;
  resolution?: 'skip' | 'update' | 'create';
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'duplicates' | 'importing';

const SUPPLIER_FIELDS = [
  { value: 'name', label: 'Legal Company Name' },
  { value: 'trading_name', label: 'Trading Name' },
  { value: 'abn', label: 'ABN' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'address', label: 'Address' },
  { value: 'payment_terms', label: 'Payment Terms (days)' },
  { value: 'notes', label: 'Notes' },
];

export function SupplierImportDialog({ open, onOpenChange, onImportComplete }: SupplierImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [importing, setImporting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

        const headers = Object.keys(results.data[0] as object);
        setCsvHeaders(headers);
        setCsvData(results.data);

        // Auto-map columns based on header names
        const autoMapping: Record<string, string> = {};
        headers.forEach(header => {
          const normalizedHeader = header.toLowerCase().trim();
          const field = SUPPLIER_FIELDS.find(f => 
            normalizedHeader.includes(f.value.toLowerCase()) ||
            normalizedHeader === f.label.toLowerCase()
          );
          if (field) {
            autoMapping[header] = field.value;
          }
        });
        setColumnMapping(autoMapping);
        setStep('mapping');
      },
      error: (error) => {
        toast({
          title: "Parse error",
          description: `Failed to parse CSV: ${error.message}`,
          variant: "destructive",
        });
      },
    });
  };

  const validateABN = (abn: string): boolean => {
    if (!abn) return true; // ABN is optional
    const cleaned = abn.replace(/\s/g, '');
    return /^\d{11}$/.test(cleaned);
  };

  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Email is optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const getMappedData = () => {
    return csvData.map((row, index) => {
      const mappedRow: any = { rowNumber: index + 1 };
      Object.entries(columnMapping).forEach(([csvColumn, fieldName]) => {
        mappedRow[fieldName] = row[csvColumn];
      });
      return mappedRow;
    });
  };

  const validateMappedData = () => {
    const errors: ValidationError[] = [];
    const mappedData = getMappedData();

    mappedData.forEach((row) => {
      // Validate required field: name
      if (!row.name || row.name.trim() === '') {
        errors.push({
          row: row.rowNumber,
          field: 'name',
          message: 'Legal Company Name is required',
        });
      }

      // Validate ABN format
      if (row.abn && !validateABN(row.abn)) {
        errors.push({
          row: row.rowNumber,
          field: 'abn',
          message: 'Invalid ABN format (must be 11 digits)',
        });
      }

      // Validate email format
      if (row.email && !validateEmail(row.email)) {
        errors.push({
          row: row.rowNumber,
          field: 'email',
          message: 'Invalid email format',
        });
      }

      // Validate payment terms
      if (row.payment_terms && isNaN(parseInt(row.payment_terms))) {
        errors.push({
          row: row.rowNumber,
          field: 'payment_terms',
          message: 'Payment terms must be a number',
        });
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const checkForDuplicates = async () => {
    setCheckingDuplicates(true);
    const mappedData = getMappedData();
    const duplicateMatches: DuplicateMatch[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      for (const row of mappedData) {
        let query = supabase
          .from("suppliers")
          .select("*")
          .eq("tenant_id", profile.tenant_id);

        // Check for duplicates by ABN or email
        const conditions = [];
        if (row.abn) {
          const cleanedABN = row.abn.replace(/\s/g, '');
          conditions.push(supabase.from("suppliers").select("*").eq("tenant_id", profile.tenant_id).eq("abn", cleanedABN));
        }
        if (row.email) {
          conditions.push(supabase.from("suppliers").select("*").eq("tenant_id", profile.tenant_id).ilike("email", row.email));
        }

        for (const condition of conditions) {
          const { data: existing } = await condition;
          if (existing && existing.length > 0) {
            duplicateMatches.push({
              row: row.rowNumber,
              existingSupplier: existing[0],
              importData: row,
              resolution: 'skip',
            });
            break;
          }
        }
      }

      setDuplicates(duplicateMatches);
      setCheckingDuplicates(false);

      if (duplicateMatches.length > 0) {
        setStep('duplicates');
      } else {
        // No duplicates, proceed to import
        await handleImport();
      }
    } catch (error) {
      console.error("Error checking duplicates:", error);
      toast({
        title: "Error",
        description: "Failed to check for duplicates",
        variant: "destructive",
      });
      setCheckingDuplicates(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const mappedData = getMappedData();
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const suppliersWithABN: string[] = [];

      for (const row of mappedData) {
        // Check if this row has a duplicate resolution
        const duplicate = duplicates.find(d => d.row === row.rowNumber);

        if (duplicate?.resolution === 'skip') {
          skippedCount++;
          continue;
        }

        const supplierData: any = {
          tenant_id: profile.tenant_id,
          name: row.name?.trim(),
          trading_name: row.trading_name?.trim() || null,
          abn: row.abn ? row.abn.replace(/\s/g, '') : null,
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          mobile: row.mobile?.trim() || null,
          address: row.address?.trim() || null,
          payment_terms: row.payment_terms ? parseInt(row.payment_terms) : null,
          notes: row.notes?.trim() || null,
          is_active: true,
        };

        if (duplicate?.resolution === 'update') {
          const { error } = await supabase
            .from("suppliers")
            .update(supplierData)
            .eq("id", duplicate.existingSupplier.id);

          if (error) throw error;
          updatedCount++;
          
          // Track for ABN validation
          if (supplierData.abn) {
            suppliersWithABN.push(duplicate.existingSupplier.id);
          }
        } else {
          const { data: inserted, error } = await supabase
            .from("suppliers")
            .insert([supplierData])
            .select()
            .single();

          if (error) throw error;
          importedCount++;
          
          // Track for ABN validation
          if (supplierData.abn && inserted) {
            suppliersWithABN.push(inserted.id);
          }
        }
      }

      // Trigger background ABN validation for all imported suppliers with ABN
      if (suppliersWithABN.length > 0) {
        console.log(`Triggering background ABN validation for ${suppliersWithABN.length} suppliers`);
        // Fire and forget - don't wait for validation to complete
        Promise.all(
          suppliersWithABN.map(async (supplierId) => {
            try {
              const { data: supplier } = await supabase
                .from("suppliers")
                .select("abn")
                .eq("id", supplierId)
                .single();

              if (supplier?.abn) {
                await supabase.functions.invoke("validate-abn", {
                  body: { abn: supplier.abn },
                });
              }
            } catch (err) {
              console.error(`ABN validation failed for supplier ${supplierId}:`, err);
            }
          })
        ).catch(err => console.error("Background ABN validation error:", err));
      }

      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      await queryClient.invalidateQueries({ queryKey: ["vendors"] });

      toast({
        title: "Import complete",
        description: `Imported ${importedCount} new suppliers, updated ${updatedCount}, skipped ${skippedCount}. ABN validation running in background.`,
      });

      handleClose();
      onImportComplete?.();
    } catch (error) {
      console.error("Error importing suppliers:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setValidationErrors([]);
    setDuplicates([]);
    setImporting(false);
    onOpenChange(false);
  };

  const handleNext = () => {
    if (step === 'mapping') {
      if (validateMappedData()) {
        setStep('preview');
      }
    } else if (step === 'preview') {
      checkForDuplicates();
    }
  };

  const handleBack = () => {
    if (step === 'mapping') {
      setStep('upload');
    } else if (step === 'preview') {
      setStep('mapping');
    } else if (step === 'duplicates') {
      setStep('preview');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Suppliers</DialogTitle>
          <DialogDescription>
            Import suppliers from a CSV file
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <div className="text-sm font-medium mb-2">
                  Click to upload or drag and drop
                </div>
                <div className="text-xs text-muted-foreground">
                  CSV file with supplier data
                </div>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </Label>
            </div>

            <div className="text-sm space-y-2">
              <p className="font-medium">CSV Format Guide:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Legal Company Name (required)</li>
                <li>Trading Name</li>
                <li>ABN (11 digits) - will be validated automatically</li>
                <li>Email</li>
                <li>Phone</li>
                <li>Mobile</li>
                <li>Address</li>
                <li>Payment Terms (days as number)</li>
                <li>Notes</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Note: ABN validation will run in the background after import to verify and enrich supplier data.
              </p>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your CSV columns to supplier fields
            </p>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {csvHeaders.map((header) => (
                <div key={header} className="flex items-center gap-4">
                  <Label className="w-1/3 text-sm font-normal">{header}</Label>
                  <Select
                    value={columnMapping[header] || 'skip'}
                    onValueChange={(value) => {
                      if (value === 'skip') {
                        const newMapping = { ...columnMapping };
                        delete newMapping[header];
                        setColumnMapping(newMapping);
                      } else {
                        setColumnMapping({ ...columnMapping, [header]: value });
                      }
                    }}
                  >
                    <SelectTrigger className="w-2/3">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip this column</SelectItem>
                      {SUPPLIER_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preview your data before importing ({csvData.length} rows)
            </p>
            {validationErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="font-medium text-sm mb-2">Validation Errors:</p>
                <ul className="text-sm space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i}>
                      Row {error.row}, {error.field}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="border rounded-lg overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Row</th>
                    {SUPPLIER_FIELDS.map((field) => (
                      <th key={field.value} className="p-2 text-left">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getMappedData().slice(0, 10).map((row) => (
                    <tr key={row.rowNumber} className="border-t">
                      <td className="p-2">{row.rowNumber}</td>
                      {SUPPLIER_FIELDS.map((field) => (
                        <td key={field.value} className="p-2">
                          {row[field.value] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvData.length > 10 && (
              <p className="text-xs text-muted-foreground">
                Showing first 10 rows of {csvData.length}
              </p>
            )}
          </div>
        )}

        {step === 'duplicates' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found {duplicates.length} potential duplicate(s). Choose how to handle each:
            </p>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {duplicates.map((dup, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Row {dup.row}: {dup.importData.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Matches existing: {dup.existingSupplier.name}
                      </p>
                    </div>
                    <Select
                      value={dup.resolution}
                      onValueChange={(value: any) => {
                        const newDuplicates = [...duplicates];
                        newDuplicates[index].resolution = value;
                        setDuplicates(newDuplicates);
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="create">Create New</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Importing suppliers...</p>
          </div>
        )}

        <DialogFooter>
          {step !== 'upload' && step !== 'importing' && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step === 'upload' && (
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <Button asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Select File
                </span>
              </Button>
            </Label>
          )}
          {(step === 'mapping' || step === 'preview') && (
            <Button onClick={handleNext} disabled={validationErrors.length > 0}>
              Next
            </Button>
          )}
          {step === 'duplicates' && (
            <Button onClick={handleImport} disabled={importing || checkingDuplicates}>
              {importing ? "Importing..." : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
