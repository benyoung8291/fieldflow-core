import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import Papa from "papaparse";
import { Loader2, Upload, Check, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  recurrence_frequency: "weekly" | "monthly" | "quarterly" | "annually";
  first_generation_date: string;
  estimated_hours?: number;
  location: {
    existingLocationId?: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    postcode?: string;
    customer_location_id?: string;
  };
}

interface LocationMatch {
  lineItemIndex: number;
  suggestedLocation: {
    id: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    postcode?: string;
  } | null;
  alternatives: Array<{
    id: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    postcode?: string;
  }>;
  action: 'use-suggested' | 'use-alternative' | 'create-new';
  selectedAlternativeId?: string;
}

export default function ImportContractDialog({ open, onOpenChange, onSuccess }: ImportContractDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [customerId, setCustomerId] = useState<string>("");
  const [contractTitle, setContractTitle] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [billingFrequency, setBillingFrequency] = useState<"monthly" | "quarterly" | "annually">("monthly");
  const [lineItems, setLineItems] = useState<ParsedLineItem[]>([]);
  const [step, setStep] = useState<"upload" | "mapping" | "location-matching" | "review">("upload");
  const [columnMappings, setColumnMappings] = useState<Record<string, string | null>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [spreadsheetData, setSpreadsheetData] = useState<any[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [expectedTotal, setExpectedTotal] = useState<string>("");
  const [locationMatches, setLocationMatches] = useState<LocationMatch[]>([]);

  const requiredFields = ['description', 'location_name', 'location_address', 'unit_price'];
  const missingRequiredFields = requiredFields.filter(field => !columnMappings[field]);

  const getValidationErrors = (item: ParsedLineItem): string[] => {
    const errors: string[] = [];
    if (!item.description?.trim()) errors.push('Description required');
    if (!item.location?.name?.trim()) errors.push('Location name required');
    if (!item.location?.address?.trim()) errors.push('Location address required');
    if (!item.unit_price || item.unit_price <= 0) errors.push('Valid unit price required');
    return errors;
  };

  const getDuplicateLocations = (): Set<number> => {
    const duplicates = new Set<number>();
    const locationMap = new Map<string, number[]>();

    lineItems.forEach((item, index) => {
      const key = `${item.location.name}|${item.location.address}`.toLowerCase();
      if (!locationMap.has(key)) {
        locationMap.set(key, []);
      }
      locationMap.get(key)!.push(index);
    });

    locationMap.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach(idx => duplicates.add(idx));
      }
    });

    return duplicates;
  };

  const duplicateLocations = getDuplicateLocations();

  const { data: customers } = useQuery({
    queryKey: ["customers-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
        .limit(1000);
      
      if (error) throw error;
      return data;
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !customerId) {
      toast.error("Please select a customer and upload a file");
      return;
    }

    setIsProcessing(true);

    try {
      Papa.parse(file, {
        complete: async (results) => {
          try {
            setSpreadsheetData(results.data);

            const { data: functionData, error: functionError } = await supabase.functions.invoke(
              "parse-contract-spreadsheet",
              {
                body: {
                  spreadsheetData: results.data,
                  customerId,
                  mode: "analyze"
                }
              }
            );

            if (functionError) throw functionError;

            if (functionData.mappings) {
              setColumnMappings(functionData.mappings);
              setAvailableColumns(functionData.availableColumns);
              setStep("mapping");
            }
          } catch (error: any) {
            console.error("Error analyzing spreadsheet:", error);
            toast.error(error.message || "Failed to analyze spreadsheet");
          } finally {
            setIsProcessing(false);
          }
        },
        error: (error) => {
          toast.error(`Failed to parse file: ${error.message}`);
          setIsProcessing(false);
        },
        header: false,
        skipEmptyLines: true,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file");
      setIsProcessing(false);
    }
  };

  const handleConfirmMappings = async () => {
    if (missingRequiredFields.length > 0) {
      toast.error(`Missing required fields: ${missingRequiredFields.join(', ')}`);
      return;
    }

    setIsProcessing(true);

    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "parse-contract-spreadsheet",
        {
          body: {
            spreadsheetData,
            columnMappings,
            customerId,
            mode: "parse"
          }
        }
      );

      if (functionError) throw functionError;

      if (functionData.lineItems && functionData.lineItems.length > 0) {
        setLineItems(functionData.lineItems);
        
        // Find potential location matches
        await findLocationMatches(functionData.lineItems);
        
        setStep("location-matching");
        toast.success(`Parsed ${functionData.lineItems.length} line items`);
      } else {
        toast.error("No line items found in spreadsheet");
      }
    } catch (error: any) {
      console.error("Error parsing spreadsheet:", error);
      toast.error(error.message || "Failed to parse spreadsheet");
    } finally {
      setIsProcessing(false);
    }
  };

  const findLocationMatches = async (items: ParsedLineItem[]) => {
    const { data: existingLocations } = await supabase
      .from("customer_locations")
      .select("id, name, address, city, state, postcode")
      .eq("customer_id", customerId)
      .eq("is_active", true);

    if (!existingLocations) {
      setLocationMatches(items.map((_, index) => ({
        lineItemIndex: index,
        suggestedLocation: null,
        alternatives: [],
        action: 'create-new'
      })));
      return;
    }

    const matches: LocationMatch[] = items.map((item, index) => {
      // Find exact matches
      const exactMatch = existingLocations.find(loc =>
        loc.name.toLowerCase().trim() === item.location.name.toLowerCase().trim() &&
        loc.address.toLowerCase().trim() === item.location.address.toLowerCase().trim()
      );

      if (exactMatch) {
        return {
          lineItemIndex: index,
          suggestedLocation: exactMatch,
          alternatives: [],
          action: 'use-suggested' as const
        };
      }

      // Find similar matches (by name OR address)
      const similarMatches = existingLocations.filter(loc => {
        const nameMatch = loc.name.toLowerCase().includes(item.location.name.toLowerCase()) ||
          item.location.name.toLowerCase().includes(loc.name.toLowerCase());
        const addressMatch = loc.address.toLowerCase().includes(item.location.address.toLowerCase()) ||
          item.location.address.toLowerCase().includes(loc.address.toLowerCase());
        return nameMatch || addressMatch;
      });

      return {
        lineItemIndex: index,
        suggestedLocation: similarMatches[0] || null,
        alternatives: similarMatches.slice(1),
        action: similarMatches.length > 0 ? 'use-suggested' as const : 'create-new' as const
      };
    });

    setLocationMatches(matches);
  };

  const handleBulkLocationAction = (action: 'accept-all' | 'create-all-new') => {
    setLocationMatches(prev => prev.map(match => ({
      ...match,
      action: action === 'accept-all' 
        ? (match.suggestedLocation ? 'use-suggested' : 'create-new')
        : 'create-new'
    })));
  };

  const handleLocationMatchAction = (index: number, action: LocationMatch['action'], alternativeId?: string) => {
    setLocationMatches(prev => prev.map((match, i) => 
      i === index 
        ? { ...match, action, selectedAlternativeId: alternativeId }
        : match
    ));
  };

  const handleConfirmLocationMatches = () => {
    setStep("review");
  };

  const startEditing = (rowIndex: number, field: string, currentValue: any) => {
    setEditingCell({ rowIndex, field });
    setEditValue(currentValue?.toString() || "");
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const saveEdit = () => {
    if (!editingCell) return;

    const { rowIndex, field } = editingCell;
    const updatedItems = [...lineItems];
    
    if (field.startsWith('location_')) {
      const locationField = field.replace('location_', '');
      updatedItems[rowIndex].location[locationField as keyof typeof updatedItems[0]['location']] = editValue as any;
    } else {
      (updatedItems[rowIndex] as any)[field] = editValue;
    }
    
    setLineItems(updatedItems);
    cancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleImport = async () => {
    if (!contractTitle || !contractStartDate || lineItems.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    const itemsWithErrors = lineItems.filter(item => getValidationErrors(item).length > 0);
    if (itemsWithErrors.length > 0) {
      toast.error(`${itemsWithErrors.length} line items have validation errors. Please fix them before importing.`);
      return;
    }

    // Validate total if provided
    if (expectedTotal) {
      const expected = parseFloat(expectedTotal);
      const calculated = calculateTotal();
      const difference = Math.abs(expected - calculated);
      const tolerance = expected * 0.01; // 1% tolerance

      if (difference > tolerance) {
        const proceed = window.confirm(
          `Total mismatch:\nExpected: ${formatCurrency(expected)}\nCalculated: ${formatCurrency(calculated)}\nDifference: ${formatCurrency(difference)}\n\nDo you want to proceed anyway?`
        );
        if (!proceed) return;
      }
    }

    setIsProcessing(true);

    try {
      const { data: contract, error: contractError } = await supabase
        .from("service_contracts")
        .insert([{
          customer_id: customerId,
          title: contractTitle,
          start_date: contractStartDate,
          billing_frequency: billingFrequency,
          status: "active",
        }] as any)
        .select()
        .single();

      if (contractError) throw contractError;

      const locationMap = new Map<string, string>();
      const lineItemsToInsert: any[] = [];

      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        const match = locationMatches[i];
        let locationId: string;

        const locationKey = `${item.location.name}|${item.location.address}`.toLowerCase();
        const cachedLocationId = locationMap.get(locationKey);

        if (cachedLocationId) {
          locationId = cachedLocationId;
        } else if (match?.action === 'use-suggested' && match.suggestedLocation) {
          locationId = match.suggestedLocation.id;
        } else if (match?.action === 'use-alternative' && match.selectedAlternativeId) {
          locationId = match.selectedAlternativeId;
        } else {
          // Create new location
          const { data: newLocation, error: locationError } = await supabase
            .from("customer_locations")
            .insert([{
              customer_id: customerId,
              name: item.location.name,
              address: item.location.address,
              city: item.location.city,
              state: item.location.state,
              postcode: item.location.postcode,
              customer_location_id: item.location.customer_location_id,
              is_primary: false,
              is_active: true,
            }] as any)
            .select()
            .single();

          if (locationError) throw locationError;
          locationId = newLocation.id;
        }

        locationMap.set(locationKey, locationId);

        lineItemsToInsert.push({
          service_contract_id: contract.id,
          customer_location_id: locationId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price,
          recurrence_frequency: item.recurrence_frequency,
          first_generation_date: item.first_generation_date,
          estimated_hours: item.estimated_hours || 0,
        });
      }

      const { error: lineItemsError } = await supabase
        .from("service_contract_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      const newLocationIds = Array.from(new Set(lineItemsToInsert.map(item => item.customer_location_id)));
      if (newLocationIds.length > 0) {
        supabase.functions.invoke("geocode-locations", {
          body: { locationIds: newLocationIds }
        });
      }

      toast.success("Contract imported successfully!");
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Failed to import contract");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setCustomerId("");
    setContractTitle("");
    setContractStartDate("");
    setBillingFrequency("monthly");
    setLineItems([]);
    setStep("upload");
    setColumnMappings({});
    setAvailableColumns([]);
    setSpreadsheetData([]);
    setEditingCell(null);
    setEditValue("");
    setExpectedTotal("");
    setLocationMatches([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Service Contract</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Select Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Upload Spreadsheet *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={!customerId}
                />
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!file || !customerId || isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Analyze Columns
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4 overflow-y-auto flex-1">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Map your spreadsheet columns to the required fields. Fields marked with * are required.
              </AlertDescription>
            </Alert>

            {/* Example Data Preview */}
            {spreadsheetData.length > 1 && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <h4 className="text-sm font-medium mb-3">Example Data Preview (First 3 Rows)</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {availableColumns.map((col) => (
                          <TableHead key={col} className="text-xs">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {spreadsheetData.slice(1, 4).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {availableColumns.map((col, colIndex) => (
                            <TableCell key={colIndex} className="text-xs">
                              {row[colIndex] || '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Map Columns</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Review the AI's suggested column mappings. Fields marked with * are required.
              </p>

              {missingRequiredFields.length > 0 && (
                <Alert className="mb-4 border-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Missing required fields: {missingRequiredFields.join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {Object.entries({
                  description: "Description *",
                  location_name: "Location Name *",
                  location_address: "Location Address *",
                  customer_location_id: "Customer Location ID",
                  recurrence_frequency: "Frequency",
                  first_generation_date: "First Date",
                  quantity: "Quantity",
                  estimated_hours: "Est. Hours",
                  unit_price: "Unit Price *",
                }).map(([field, label]) => {
                  const isRequired = requiredFields.includes(field);
                  const isMissing = isRequired && !columnMappings[field];
                  
                  return (
                    <div key={field} className={`grid grid-cols-2 gap-4 items-center p-3 rounded-lg border ${isMissing ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
                      <Label className={isMissing ? 'text-destructive' : ''}>
                        {label}
                        {isMissing && <span className="ml-2 text-xs">(Required)</span>}
                      </Label>
                      <Select
                        value={columnMappings[field] || ""}
                        onValueChange={(value) =>
                          setColumnMappings({ ...columnMappings, [field]: value })
                        }
                      >
                        <SelectTrigger className={isMissing ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableColumns.filter(col => col && col.trim()).map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("upload")} disabled={isProcessing}>
                Back
              </Button>
              <Button 
                onClick={handleConfirmMappings} 
                disabled={isProcessing || missingRequiredFields.length > 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm & Parse
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "location-matching" && (
          <div className="space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between">
              <Alert className="flex-1 mr-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Review and confirm location matches. We found {locationMatches.filter(m => m.suggestedLocation).length} potential matches.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkLocationAction('accept-all')}
                >
                  Accept All Suggestions
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkLocationAction('create-all-new')}
                >
                  Create All New
                </Button>
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto border rounded-lg">
              {lineItems.map((item, index) => {
                const match = locationMatches[index];
                if (!match) return null;

                return (
                  <div key={index} className="p-4 border-b last:border-b-0 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{item.description}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Import: {item.location.name} - {item.location.address}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {match.suggestedLocation && (
                        <label className="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-muted/50">
                          <input
                            type="radio"
                            name={`location-${index}`}
                            checked={match.action === 'use-suggested'}
                            onChange={() => handleLocationMatchAction(index, 'use-suggested')}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-success" />
                              <span className="text-sm font-medium">Use Existing Location (Recommended)</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {match.suggestedLocation.name} - {match.suggestedLocation.address}
                              {match.suggestedLocation.city && `, ${match.suggestedLocation.city}`}
                              {match.suggestedLocation.state && ` ${match.suggestedLocation.state}`}
                            </p>
                          </div>
                        </label>
                      )}

                      {match.alternatives.length > 0 && (
                        <div className="space-y-2 ml-6">
                          <p className="text-xs font-medium text-muted-foreground">Other Possible Matches:</p>
                          {match.alternatives.map((alt) => (
                            <label key={alt.id} className="flex items-start gap-3 p-2 border rounded cursor-pointer hover:bg-muted/50">
                              <input
                                type="radio"
                                name={`location-${index}`}
                                checked={match.action === 'use-alternative' && match.selectedAlternativeId === alt.id}
                                onChange={() => handleLocationMatchAction(index, 'use-alternative', alt.id)}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <p className="text-xs">
                                  {alt.name} - {alt.address}
                                  {alt.city && `, ${alt.city}`}
                                  {alt.state && ` ${alt.state}`}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}

                      <label className="flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-muted/50">
                        <input
                          type="radio"
                          name={`location-${index}`}
                          checked={match.action === 'create-new'}
                          onChange={() => handleLocationMatchAction(index, 'create-new')}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Upload className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Create New Location</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Create a new location with the imported details
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back to Mapping
              </Button>
              <Button onClick={handleConfirmLocationMatches}>
                Continue to Review
              </Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4 overflow-hidden flex flex-col flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Contract Title *</Label>
                <Input
                  id="title"
                  value={contractTitle}
                  onChange={(e) => setContractTitle(e.target.value)}
                  placeholder="Enter contract title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing">Billing Frequency *</Label>
                <Select value={billingFrequency} onValueChange={(value: any) => setBillingFrequency(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedTotal">Expected Total (Optional)</Label>
                <Input
                  id="expectedTotal"
                  type="number"
                  step="0.01"
                  value={expectedTotal}
                  onChange={(e) => setExpectedTotal(e.target.value)}
                  placeholder="Enter expected total for validation"
                />
              </div>
            </div>

            {expectedTotal && (
              <Alert className={
                Math.abs(parseFloat(expectedTotal) - calculateTotal()) > parseFloat(expectedTotal) * 0.01
                  ? "border-warning"
                  : "border-success"
              }>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div>Expected Total: {formatCurrency(parseFloat(expectedTotal))}</div>
                    <div>Calculated Total: {formatCurrency(calculateTotal())}</div>
                    <div className={
                      Math.abs(parseFloat(expectedTotal) - calculateTotal()) > parseFloat(expectedTotal) * 0.01
                        ? "text-warning font-medium"
                        : "text-success"
                    }>
                      Difference: {formatCurrency(Math.abs(parseFloat(expectedTotal) - calculateTotal()))}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Line Items ({lineItems.length})</h3>
                {duplicateLocations.size > 0 && (
                  <Alert className="inline-flex items-center py-1 px-3 border-warning">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span className="text-sm">{duplicateLocations.size} duplicate locations detected</span>
                  </Alert>
                )}
              </div>
              
              <div className="border rounded-lg overflow-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Customer Loc ID</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Est. Hours</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => {
                      const isDuplicate = duplicateLocations.has(index);
                      const errors = getValidationErrors(item);
                      const hasErrors = errors.length > 0;
                      
                      return (
                        <TableRow 
                          key={index}
                          className={hasErrors ? "border-l-4 border-l-destructive bg-destructive/5" : ""}
                          title={hasErrors ? errors.join(', ') : undefined}
                        >
                          <TableCell 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => startEditing(index, 'description', item.description)}
                          >
                            {editingCell?.rowIndex === index && editingCell?.field === 'description' ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                                className="h-8"
                              />
                            ) : (
                              <span className={!item.description ? 'text-destructive' : ''}>
                                {item.description || '(Required)'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div 
                                className="cursor-pointer hover:bg-muted/50 p-1 rounded"
                                onClick={() => startEditing(index, 'location_name', item.location.name)}
                              >
                                {editingCell?.rowIndex === index && editingCell?.field === 'location_name' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={saveEdit}
                                    autoFocus
                                    className="h-7 text-sm font-medium"
                                  />
                                ) : (
                                  <span className={`text-sm font-medium ${isDuplicate ? 'text-warning' : ''} ${!item.location.name ? 'text-destructive' : ''}`}>
                                    {item.location.name || '(Required)'}
                                  </span>
                                )}
                              </div>
                              <div 
                                className="cursor-pointer hover:bg-muted/50 p-1 rounded"
                                onClick={() => startEditing(index, 'location_address', item.location.address)}
                              >
                                {editingCell?.rowIndex === index && editingCell?.field === 'location_address' ? (
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={saveEdit}
                                    autoFocus
                                    className="h-7 text-sm"
                                  />
                                ) : (
                                  <span className={`text-xs text-muted-foreground ${!item.location.address ? 'text-destructive' : ''}`}>
                                    {item.location.address || '(Required)'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => startEditing(index, 'customer_location_id', item.location.customer_location_id)}
                          >
                            {editingCell?.rowIndex === index && editingCell?.field === 'customer_location_id' ? (
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                                className="h-8"
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {item.location.customer_location_id || '-'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className="capitalize cursor-pointer hover:bg-muted/50"
                            onClick={() => startEditing(index, 'recurrence_frequency', item.recurrence_frequency)}
                          >
                            {editingCell?.rowIndex === index && editingCell?.field === 'recurrence_frequency' ? (
                              <Select 
                                value={editValue} 
                                onValueChange={(val) => { 
                                  setEditValue(val);
                                  setTimeout(() => {
                                    const updatedItems = [...lineItems];
                                    updatedItems[index].recurrence_frequency = val as any;
                                    setLineItems(updatedItems);
                                    cancelEditing();
                                  }, 0);
                                }}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="annually">Annually</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              item.recurrence_frequency
                            )}
                          </TableCell>
                          <TableCell
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => startEditing(index, 'first_generation_date', item.first_generation_date)}
                          >
                            {editingCell?.rowIndex === index && editingCell?.field === 'first_generation_date' ? (
                              <Input
                                type="date"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                                className="h-8"
                              />
                            ) : (
                              new Date(item.first_generation_date).toLocaleDateString()
                            )}
                          </TableCell>
                          <TableCell
                            className="text-right cursor-pointer hover:bg-muted/50"
                            onClick={() => startEditing(index, 'quantity', item.quantity)}
                          >
                            {editingCell?.rowIndex === index && editingCell?.field === 'quantity' ? (
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                                className="h-8 text-right"
                              />
                            ) : (
                              item.quantity
                            )}
                          </TableCell>
                          <TableCell
                            className="text-right cursor-pointer hover:bg-muted/50"
                            onClick={() => startEditing(index, 'estimated_hours', item.estimated_hours)}
                          >
                            {editingCell?.rowIndex === index && editingCell?.field === 'estimated_hours' ? (
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                                className="h-8 text-right"
                              />
                            ) : (
                              item.estimated_hours || 0
                            )}
                          </TableCell>
                          <TableCell
                            className="text-right cursor-pointer hover:bg-muted/50"
                            onClick={() => startEditing(index, 'unit_price', item.unit_price)}
                          >
                            {editingCell?.rowIndex === index && editingCell?.field === 'unit_price' ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={saveEdit}
                                autoFocus
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className={!item.unit_price || item.unit_price <= 0 ? 'text-destructive' : ''}>
                                {item.unit_price ? formatCurrency(item.unit_price) : '(Required)'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep("location-matching")} disabled={isProcessing}>
                Back to Location Matching
              </Button>
              <Button onClick={handleImport} disabled={isProcessing || lineItems.length === 0}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Import Contract ({lineItems.length} items, {formatCurrency(calculateTotal())})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
