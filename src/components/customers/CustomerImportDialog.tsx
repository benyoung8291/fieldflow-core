import { useState, useRef } from "react";
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

type ImportStep = "upload" | "mapping" | "preview" | "duplicates" | "importing";

interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface DuplicateMatch {
  rowIndex: number;
  newData: any;
  existingCustomer: any;
  matchType: "abn" | "email" | "both";
  selectedFields: string[];
  action: "skip" | "update";
}

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
  { value: "department", label: "Department" },
  { value: "acumatica_customer_id", label: "MYOB Customer Number" },
  { value: "notes", label: "Notes" },
  { value: "_skip", label: "- Skip this column -" },
];

export default function CustomerImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: CustomerImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

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

  const validateABN = (abn: string): boolean => {
    if (!abn) return true; // ABN is optional
    
    // Remove spaces and check if it's 11 digits
    const cleanABN = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanABN)) return false;
    
    // Validate ABN checksum
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;
    
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(cleanABN[i], 10);
      const weight = weights[i];
      sum += (i === 0 ? digit - 1 : digit) * weight;
    }
    
    return sum % 89 === 0;
  };

  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Email is optional
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

  const validateRowData = (): ValidationError[] => {
    const errors: ValidationError[] = [];
    const mappedData = getMappedData();

    mappedData.forEach((row, index) => {
      // Validate required name field
      if (!row.name || row.name.trim() === "") {
        errors.push({
          row: index + 1,
          field: "name",
          value: row.name || "",
          message: "Name is required",
        });
      }

      // NOTE: ABN validation is now done in background after import
      // We no longer block import on ABN format issues

      // Validate email format
      if (row.email && !validateEmail(row.email)) {
        errors.push({
          row: index + 1,
          field: "email",
          value: row.email,
          message: "Invalid email format",
        });
      }

      // Validate billing_email format
      if (row.billing_email && !validateEmail(row.billing_email)) {
        errors.push({
          row: index + 1,
          field: "billing_email",
          value: row.billing_email,
          message: "Invalid billing email format",
        });
      }

      // Validate payment_terms is a number
      if (row.payment_terms && (isNaN(row.payment_terms) || row.payment_terms < 0)) {
        errors.push({
          row: index + 1,
          field: "payment_terms",
          value: String(row.payment_terms),
          message: "Payment terms must be a positive number",
        });
      }
    });

    return errors;
  };

  const checkForDuplicates = async () => {
    setCheckingDuplicates(true);
    try {
      const mappedData = getMappedData();
      const duplicateMatches: DuplicateMatch[] = [];

      // Get all existing customers
      const { data: existingCustomers, error } = await supabase
        .from("customers")
        .select("*");

      if (error) throw error;

      // Check each row for duplicates
      mappedData.forEach((row, index) => {
        if (!row.abn && !row.email) return; // Skip if no identifying info

        const match = existingCustomers?.find((existing) => {
          if (row.abn && existing.abn === row.abn) return true;
          if (row.email && existing.email === row.email) return true;
          return false;
        });

        if (match) {
          const matchType =
            row.abn === match.abn && row.email === match.email
              ? "both"
              : row.abn === match.abn
              ? "abn"
              : "email";

          // Get all fields that are different
          const changedFields = Object.keys(row).filter(
            (key) => row[key] !== match[key] && row[key] !== undefined && row[key] !== ""
          );

          duplicateMatches.push({
            rowIndex: index + 1,
            newData: row,
            existingCustomer: match,
            matchType,
            selectedFields: [], // User will select which to update
            action: "skip", // Default to skip
          });
        }
      });

      setDuplicates(duplicateMatches);
      return duplicateMatches;
    } catch (error: any) {
      toast({
        title: "Error checking duplicates",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handlePreview = async () => {
    if (!validateMappedData()) return;
    
    // Validate all row data
    const errors = validateRowData();
    setValidationErrors(errors);
    
    if (errors.length > 0) {
      toast({
        title: "Validation errors found",
        description: `Found ${errors.length} validation error(s). Please review before importing.`,
        variant: "destructive",
      });
    }
    
    setStep("preview");
  };

  const handleCheckDuplicates = async () => {
    const foundDuplicates = await checkForDuplicates();
    if (foundDuplicates.length > 0) {
      setStep("duplicates");
      toast({
        title: "Duplicates found",
        description: `Found ${foundDuplicates.length} potential duplicate(s)`,
      });
    } else {
      toast({
        title: "No duplicates",
        description: "All customers are unique, proceeding to import",
      });
      // Automatically proceed to import when no duplicates
      await handleImport();
    }
  };

  const handleDuplicateAction = (index: number, action: "skip" | "update") => {
    setDuplicates((prev) =>
      prev.map((dup, i) => (i === index ? { ...dup, action } : dup))
    );
  };

  const handleFieldSelection = (duplicateIndex: number, field: string, selected: boolean) => {
    setDuplicates((prev) =>
      prev.map((dup, i) => {
        if (i !== duplicateIndex) return dup;
        const selectedFields = selected
          ? [...dup.selectedFields, field]
          : dup.selectedFields.filter((f) => f !== field);
        return { ...dup, selectedFields };
      })
    );
  };

  const validateABNsInBackground = async (tenantId: string) => {
    // Run ABN validation in background without blocking
    setTimeout(async () => {
      try {
        // Get all customers with pending ABN validation
        const { data: pendingCustomers, error: fetchError } = await supabase
          .from("customers")
          .select("id, abn, name")
          .eq("tenant_id", tenantId)
          .eq("abn_validation_status", "pending")
          .not("abn", "is", null);

        if (fetchError) {
          console.error("Error fetching pending ABN validations:", fetchError);
          return;
        }

        if (!pendingCustomers || pendingCustomers.length === 0) return;

        console.log(`Validating ${pendingCustomers.length} ABNs in background...`);

        // Validate each ABN
        for (const customer of pendingCustomers) {
          try {
            const { data: validationResult, error: validationError } = await supabase.functions.invoke(
              "validate-abn",
              {
                body: { abn: customer.abn },
              }
            );

            if (validationError) throw validationError;

            // Update customer with validation result
            const updateData: any = {
              abn_validated_at: new Date().toISOString(),
            };

            if (validationResult.valid) {
              updateData.abn_validation_status = "valid";
              updateData.abn_validation_error = null;
              // Optionally populate legal name from ABN if not already set
              if (validationResult.legalName) {
                const { data: existingCustomer } = await supabase
                  .from("customers")
                  .select("legal_company_name")
                  .eq("id", customer.id)
                  .single();
                
                if (!existingCustomer?.legal_company_name) {
                  updateData.legal_company_name = validationResult.legalName;
                }
              }
            } else {
              updateData.abn_validation_status = "invalid";
              updateData.abn_validation_error = validationResult.error || "ABN validation failed";
            }

            await supabase
              .from("customers")
              .update(updateData)
              .eq("id", customer.id);

            console.log(`Validated ABN for ${customer.name}: ${updateData.abn_validation_status}`);
          } catch (error: any) {
            console.error(`Error validating ABN for customer ${customer.id}:`, error);
            // Mark as invalid on error
            await supabase
              .from("customers")
              .update({
                abn_validation_status: "invalid",
                abn_validation_error: error.message || "Failed to validate ABN",
                abn_validated_at: new Date().toISOString(),
              })
              .eq("id", customer.id);
          }
        }

        console.log("Background ABN validation complete");
      } catch (error) {
        console.error("Background ABN validation error:", error);
      }
    }, 1000); // Start after 1 second delay
  };

  const handleImport = async () => {
    // Don't allow import if there are validation errors
    if (validationErrors.length > 0) {
      toast({
        title: "Cannot import",
        description: "Please fix all validation errors before importing",
        variant: "destructive",
      });
      return;
    }

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
      
      // Separate records into new inserts and updates
      const duplicateIds = new Set(duplicates.map(d => d.rowIndex - 1));
      const newCustomers: any[] = [];
      const updates: { id: string; data: any }[] = [];

      mappedData.forEach((row, index) => {
        const duplicate = duplicates.find(d => d.rowIndex - 1 === index);
        
        if (duplicate && duplicate.action === "update" && duplicate.selectedFields.length > 0) {
          // Build update object with only selected fields
          const updateData: any = {};
          duplicate.selectedFields.forEach(field => {
            if (row[field] !== undefined) {
              updateData[field] = row[field];
            }
          });
          
          updates.push({
            id: duplicate.existingCustomer.id,
            data: updateData,
          });
        } else if (!duplicate) {
          // Only insert if NOT a duplicate (skip means don't insert or update)
          newCustomers.push({
            ...row,
            tenant_id: profile.tenant_id,
            is_active: true,
            // Set ABN validation status to pending if ABN exists
            abn_validation_status: row.abn ? 'pending' : null,
          });
        }
        // If duplicate with action "skip", do nothing (don't insert or update)
      });

      let insertCount = 0;
      let updateCount = 0;

      // Perform inserts
      if (newCustomers.length > 0) {
        const { error: insertError } = await supabase
          .from("customers")
          .insert(newCustomers);

        if (insertError) throw insertError;
        insertCount = newCustomers.length;
      }

      // Perform updates one by one to ensure audit logging
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("customers")
          .update(update.data)
          .eq("id", update.id);

        if (updateError) throw updateError;
        updateCount++;
      }

      const message = [];
      if (insertCount > 0) message.push(`${insertCount} new customer(s)`);
      if (updateCount > 0) message.push(`${updateCount} updated customer(s)`);

      toast({
        title: "Import successful",
        description: `Imported ${message.join(" and ")}. ABN validation running in background.`,
      });

      // Trigger background ABN validation for newly imported customers with pending status
      if (insertCount > 0) {
        validateABNsInBackground(profile.tenant_id);
      }

      onImportComplete();
      handleClose();
    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
      setStep(duplicates.length > 0 ? "duplicates" : "preview");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setValidationErrors([]);
    setDuplicates([]);
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
            {step === "duplicates" && "Resolve duplicate customers"}
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
            <Badge variant={step === "duplicates" ? "default" : "secondary"}>4. Duplicates</Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant={step === "importing" ? "default" : "secondary"}>5. Import</Badge>
          </div>

          {/* Upload Step */}
          {step === "upload" && (
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="text-lg font-medium mb-2">Click to upload CSV</div>
              <div className="text-sm text-muted-foreground mb-4">
                Upload a CSV file with customer data
              </div>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
              <Input
                ref={fileInputRef}
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
                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="destructive">{validationErrors.length}</Badge>
                      <span className="font-medium text-destructive">Validation Errors</span>
                    </div>
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {validationErrors.map((error, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-destructive pl-3">
                            <div className="font-medium">Row {error.row}</div>
                            <div className="text-muted-foreground">
                              {error.field}: {error.message}
                            </div>
                            {error.value && (
                              <div className="text-xs text-muted-foreground">
                                Value: "{error.value}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Success indicator */}
                {validationErrors.length === 0 && (
                  <div className="bg-success/10 border border-success rounded-lg p-3 mb-4">
                    <span className="text-success font-medium">
                      ✓ All validation checks passed
                    </span>
                  </div>
                )}

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

          {/* Duplicates Step */}
          {step === "duplicates" && (
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary">{duplicates.length}</Badge>
                  <span className="font-medium">Duplicate customers found</span>
                </div>

                {duplicates.map((duplicate, index) => {
                  const changedFields = Object.keys(duplicate.newData).filter(
                    (key) =>
                      duplicate.newData[key] !== duplicate.existingCustomer[key] &&
                      duplicate.newData[key] !== undefined &&
                      duplicate.newData[key] !== ""
                  );

                  return (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">
                            Row {duplicate.rowIndex}: {duplicate.newData.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Matches existing customer by{" "}
                            <Badge variant="outline" className="ml-1">
                              {duplicate.matchType === "both"
                                ? "ABN & Email"
                                : duplicate.matchType.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={duplicate.action === "skip" ? "default" : "outline"}
                            onClick={() => handleDuplicateAction(index, "skip")}
                          >
                            Skip
                          </Button>
                          <Button
                            size="sm"
                            variant={duplicate.action === "update" ? "default" : "outline"}
                            onClick={() => handleDuplicateAction(index, "update")}
                          >
                            Update
                          </Button>
                        </div>
                      </div>

                      {duplicate.action === "update" && (
                        <div className="space-y-2 border-t pt-4">
                          <div className="text-sm font-medium mb-2">
                            Select fields to update:
                          </div>
                          {changedFields.map((field) => (
                            <label
                              key={field}
                              className="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={duplicate.selectedFields.includes(field)}
                                onChange={(e) =>
                                  handleFieldSelection(index, field, e.target.checked)
                                }
                                className="mt-1"
                              />
                              <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <div className="font-medium capitalize">
                                    {field.replace(/_/g, " ")}
                                  </div>
                                  <div className="text-muted-foreground">
                                    Current: {String(duplicate.existingCustomer[field] || "-")}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-success font-medium">New Value</div>
                                  <div>{String(duplicate.newData[field])}</div>
                                </div>
                              </div>
                            </label>
                          ))}
                          {changedFields.length === 0 && (
                            <div className="text-sm text-muted-foreground">
                              No field differences detected
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
              <Button 
                onClick={handleCheckDuplicates} 
                disabled={checkingDuplicates || validationErrors.length > 0}
              >
                {checkingDuplicates ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Checking...
                  </>
                ) : (
                  "Next: Check Duplicates"
                )}
              </Button>
            </>
          )}
          {step === "duplicates" && (
            <>
              <Button variant="outline" onClick={() => setStep("preview")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                Import ({duplicates.filter(d => d.action === "update").length} updates,{" "}
                {csvData.length - duplicates.filter(d => d.action !== "skip").length} new)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
