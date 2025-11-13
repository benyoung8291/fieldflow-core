import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import { Loader2, Upload, Check, X } from "lucide-react";
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
    latitude?: number;
    longitude?: number;
    formatted_address?: string;
    geocoding_status?: 'success' | 'failed';
  };
}

export default function ImportContractDialog({ open, onOpenChange, onSuccess }: ImportContractDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [customerId, setCustomerId] = useState<string>("");
  const [contractTitle, setContractTitle] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [billingFrequency, setBillingFrequency] = useState<"monthly" | "quarterly" | "annually">("monthly");
  const [lineItems, setLineItems] = useState<ParsedLineItem[]>([]);
  const [step, setStep] = useState<"upload" | "mapping" | "review">("upload");
  const [columnMappings, setColumnMappings] = useState<Record<string, string | null>>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [spreadsheetData, setSpreadsheetData] = useState<any[]>([]);
  const [failedGeocodingItems, setFailedGeocodingItems] = useState<number[]>([]);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [isRetryingGeocode, setIsRetryingGeocode] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Required fields for validation
  const requiredFields = ['description', 'location_name', 'unit_price'];
  const missingRequiredFields = requiredFields.filter(field => !columnMappings[field]);

  // Fetch customers for selection
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
      // Parse CSV file
      Papa.parse(file, {
        complete: async (results) => {
          try {
            // Store spreadsheet data for later parsing
            setSpreadsheetData(results.data);

            // Call edge function to analyze columns
            const { data: functionData, error: functionError } = await supabase.functions.invoke(
              "parse-contract-spreadsheet",
              {
                body: {
                  spreadsheetData: results.data,
                  customerId: customerId,
                  mode: "analyze",
                },
              }
            );

            if (functionError) throw functionError;

            // Set suggested mappings and available columns (filter out empty strings)
            setColumnMappings(functionData.mappings || {});
            setAvailableColumns((functionData.availableColumns || []).filter((col: string) => col && col.trim() !== ""));
            setStep("mapping");

            toast.success("Analyzed spreadsheet structure");
          } catch (error: any) {
            console.error("Error parsing spreadsheet:", error);
            toast.error(error.message || "Failed to parse spreadsheet");
          } finally {
            setIsProcessing(false);
          }
        },
        error: (error) => {
          console.error("CSV parse error:", error);
          toast.error("Failed to read CSV file");
          setIsProcessing(false);
        },
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to process file");
      setIsProcessing(false);
    }
  };

  const handleConfirmMappings = async () => {
    setIsProcessing(true);

    try {
      // Parse with confirmed mappings
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        "parse-contract-spreadsheet",
        {
          body: {
            spreadsheetData: spreadsheetData,
            customerId: customerId,
            mode: "parse",
            columnMappings: columnMappings,
          },
        }
      );

      if (functionError) throw functionError;

      setLineItems(functionData.lineItems || []);
      setFailedGeocodingItems(functionData.failedGeocodingItems || []);
      setStep("review");

      // Show notification if rows were limited
      if (functionData.hasMoreRows) {
        toast.warning(
          `Your spreadsheet has ${functionData.totalRows} rows. Only the first ${functionData.processedRows} rows were processed due to the 1,000 row limit.`
        );
      }

      toast.success(`Parsed ${functionData.lineItems?.length || 0} line items`);
    } catch (error: any) {
      console.error("Error parsing with mappings:", error);
      toast.error(error.message || "Failed to parse spreadsheet");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryGeocode = async (itemIndex: number) => {
    setIsRetryingGeocode(true);
    
    try {
      const item = lineItems[itemIndex];
      const addressString = `${item.location.address}, ${item.location.city || ''}, ${item.location.state || ''}, ${item.location.postcode || ''}`.trim();
      
      // Call Google Geocoding API directly
      const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke(
        "places-details",
        {
          body: { address: addressString }
        }
      );
      
      if (geocodeError) throw geocodeError;
      
      if (geocodeData.latitude && geocodeData.longitude) {
        // Update the line item with geocoded data
        const updatedItems = [...lineItems];
        updatedItems[itemIndex].location.latitude = geocodeData.latitude;
        updatedItems[itemIndex].location.longitude = geocodeData.longitude;
        updatedItems[itemIndex].location.geocoding_status = 'success';
        if (geocodeData.formatted_address) {
          updatedItems[itemIndex].location.formatted_address = geocodeData.formatted_address;
        }
        
        setLineItems(updatedItems);
        
        // Remove from failed list
        setFailedGeocodingItems(prev => prev.filter(i => i !== itemIndex));
        
        toast.success("Address validated successfully");
      } else {
        toast.error("Unable to validate this address");
      }
    } catch (error: any) {
      console.error("Retry geocoding error:", error);
      toast.error("Failed to validate address");
    } finally {
      setIsRetryingGeocode(false);
    }
  };

  const handleUpdateAddress = (itemIndex: number, field: string, value: string) => {
    const updatedItems = [...lineItems];
    (updatedItems[itemIndex].location as any)[field] = value;
    setLineItems(updatedItems);
  };

  const startEditing = (rowIndex: number, field: string, currentValue: any) => {
    setEditingCell({ rowIndex, field });
    setEditValue(String(currentValue || ''));
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = () => {
    if (!editingCell) return;
    
    const { rowIndex, field } = editingCell;
    const updatedItems = [...lineItems];
    
    // Handle different field types
    if (field === 'description') {
      updatedItems[rowIndex].description = editValue;
    } else if (field === 'quantity') {
      updatedItems[rowIndex].quantity = parseFloat(editValue) || 1;
    } else if (field === 'unit_price') {
      updatedItems[rowIndex].unit_price = parseFloat(editValue) || 0;
    } else if (field === 'estimated_hours') {
      updatedItems[rowIndex].estimated_hours = parseFloat(editValue) || 0;
    } else if (field === 'first_generation_date') {
      updatedItems[rowIndex].first_generation_date = editValue;
    } else if (field === 'recurrence_frequency') {
      updatedItems[rowIndex].recurrence_frequency = editValue as any;
    } else if (field === 'location_name') {
      updatedItems[rowIndex].location.name = editValue;
    } else if (field === 'location_address') {
      updatedItems[rowIndex].location.address = editValue;
    } else if (field === 'customer_location_id') {
      updatedItems[rowIndex].location.customer_location_id = editValue;
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

  const handleImport = async () => {
    if (!customerId || !contractTitle || !contractStartDate || lineItems.length === 0) {
      toast.error("Please fill in all required contract details");
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get tenant_id from user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Unable to get tenant information");

      // Get next contract number
      const { data: lastContract } = await supabase
        .from("service_contracts")
        .select("contract_number")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const nextNumber = lastContract?.contract_number
        ? parseInt(lastContract.contract_number.split("-")[1]) + 1
        : 1;
      const contractNumber = `SC-${String(nextNumber).padStart(5, "0")}`;

      // Create locations that don't exist
      const locationsToCreate = lineItems.filter(item => !item.location.existingLocationId);
      const createdLocationMap = new Map<string, string>();

      // Collect unique location keys to check for existing locations
      const uniqueLocationKeys = new Set<string>();
      for (const item of locationsToCreate) {
        const locationKey = `${item.location.name}-${item.location.address}`;
        uniqueLocationKeys.add(locationKey);
      }

      // Check database for existing locations with the same name and address
      if (uniqueLocationKeys.size > 0) {
        const locationChecks = Array.from(uniqueLocationKeys).map(async (locationKey) => {
          const [name, address] = locationKey.split('-');
          const { data: existingLocation } = await supabase
            .from("customer_locations")
            .select("id, name, address")
            .eq("tenant_id", profile.tenant_id)
            .eq("customer_id", customerId)
            .eq("name", name)
            .eq("address", address)
            .maybeSingle();
          
          return { locationKey, existingLocation };
        });

        const existingLocationsResults = await Promise.all(locationChecks);
        
        // Map existing locations
        for (const { locationKey, existingLocation } of existingLocationsResults) {
          if (existingLocation) {
            createdLocationMap.set(locationKey, existingLocation.id);
            console.log(`Using existing location for ${locationKey}: ${existingLocation.id}`);
          }
        }
      }

      // Create only locations that don't already exist
      for (const item of locationsToCreate) {
        const locationKey = `${item.location.name}-${item.location.address}`;
        if (!createdLocationMap.has(locationKey)) {
          const { data: newLocation, error: locationError } = await supabase
            .from("customer_locations")
            .insert({
              tenant_id: profile.tenant_id,
              customer_id: customerId,
              name: item.location.name,
              address: item.location.address,
              city: item.location.city,
              state: item.location.state,
              postcode: item.location.postcode,
              customer_location_id: item.location.customer_location_id || null,
              latitude: item.location.latitude,
              longitude: item.location.longitude,
            })
            .select()
            .single();

          if (locationError) throw locationError;
          createdLocationMap.set(locationKey, newLocation.id);
          console.log(`Created new location for ${locationKey}: ${newLocation.id}`);
        }
      }

      // Create service contract
      const { data: contract, error: contractError } = await supabase
        .from("service_contracts")
        .insert({
          tenant_id: profile.tenant_id,
          contract_number: contractNumber,
          customer_id: customerId,
          title: contractTitle,
          start_date: contractStartDate,
          billing_frequency: billingFrequency,
          status: "active",
          auto_generate: true,
          created_by: user.id,
          total_contract_value: lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0),
        })
        .select()
        .single();

      if (contractError) throw contractError;

      // Create line items
      const lineItemsToInsert = lineItems.map((item, index) => {
        const locationKey = `${item.location.name}-${item.location.address}`;
        const locationId = item.location.existingLocationId || createdLocationMap.get(locationKey);

        return {
          contract_id: contract.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.quantity * item.unit_price,
          recurrence_frequency: item.recurrence_frequency,
          first_generation_date: item.first_generation_date,
          next_generation_date: item.first_generation_date,
          location_id: locationId,
          estimated_hours: item.estimated_hours || 0,
          item_order: index,
          is_active: true,
          tenant_id: profile.tenant_id,
        };
      });

      const { error: lineItemsError } = await supabase
        .from("service_contract_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      toast.success("Service contract imported successfully");

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
    setColumnMappings({});
    setAvailableColumns([]);
    setSpreadsheetData([]);
    setStep("upload");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Service Contract from Spreadsheet</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Upload Spreadsheet (CSV) *</Label>
              <Input
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || !customerId || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Parse Spreadsheet
                </>
              )}
            </Button>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Column Mapping</h3>
              <p className="text-sm text-muted-foreground">
                Review and adjust which columns contain each type of information. Example values are shown to help verify your selections.
              </p>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Field Name</TableHead>
                    <TableHead className="w-[250px]">Mapped Column</TableHead>
                    <TableHead>Example Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries({
                    description: "Description",
                    location_name: "Location Name",
                    location_address: "Location Address",
                    location_city: "City",
                    location_state: "State",
                    location_postcode: "Postcode",
                    customer_location_id: "Customer Location ID",
                    unit_price: "Unit Price",
                    quantity: "Quantity",
                    estimated_hours: "Estimated Hours",
                    frequency: "Frequency",
                    start_date: "Start Date",
                  }).map(([field, label]) => {
                    const mappedColumn = columnMappings[field];
                    let exampleValues = "";
                    
                    if (mappedColumn && spreadsheetData.length > 1) {
                      // Get column index from header row
                      const headerRow = spreadsheetData[0] as any[];
                      const columnIndex = headerRow.indexOf(mappedColumn);
                      
                      if (columnIndex !== -1) {
                        // Get first 2 non-empty values as examples
                        const examples = spreadsheetData
                          .slice(1, 6)
                          .map((row: any) => row[columnIndex])
                          .filter((val: any) => val !== null && val !== undefined && val !== "")
                          .slice(0, 2);
                        exampleValues = examples.join(", ");
                      }
                    }

                    return (
                      <TableRow key={field}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell>
                          <Select
                            value={columnMappings[field] || "none"}
                            onValueChange={(value) =>
                              setColumnMappings((prev) => ({
                                ...prev,
                                [field]: value === "none" ? null : value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {availableColumns.map((col) => (
                                <SelectItem key={col} value={col}>
                                  {col}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {exampleValues || <span className="italic">No data</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {missingRequiredFields.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-start gap-2">
                  <X className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-destructive">Required fields not mapped</p>
                    <p className="text-sm text-muted-foreground">
                      The following required fields must be mapped before proceeding:
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {missingRequiredFields.map(field => (
                        <li key={field}>
                          {field === 'description' && 'Description'}
                          {field === 'location_name' && 'Location Name'}
                          {field === 'unit_price' && 'Unit Price'}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
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

        {step === "review" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
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
            </div>

            {failedGeocodingItems.length > 0 && (
              <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <X className="h-5 w-5 text-warning mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-warning">Address Validation Failed</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {failedGeocodingItems.length} location{failedGeocodingItems.length > 1 ? 's' : ''} could not be validated. 
                      Please review and correct the addresses below, then retry validation.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 mt-3">
                  {failedGeocodingItems.map((itemIndex) => {
                    const item = lineItems[itemIndex];
                    const isEditing = editingAddressIndex === itemIndex;
                    
                    return (
                      <div key={itemIndex} className="bg-background rounded border p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.location.name}</p>
                            {!isEditing ? (
                              <p className="text-sm text-muted-foreground">
                                {item.location.address}
                                {item.location.city && `, ${item.location.city}`}
                                {item.location.state && `, ${item.location.state}`}
                                {item.location.postcode && ` ${item.location.postcode}`}
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <Input
                                  placeholder="Street Address"
                                  value={item.location.address}
                                  onChange={(e) => handleUpdateAddress(itemIndex, 'address', e.target.value)}
                                  className="col-span-2"
                                />
                                <Input
                                  placeholder="City/Suburb"
                                  value={item.location.city || ''}
                                  onChange={(e) => handleUpdateAddress(itemIndex, 'city', e.target.value)}
                                />
                                <Input
                                  placeholder="State"
                                  value={item.location.state || ''}
                                  onChange={(e) => handleUpdateAddress(itemIndex, 'state', e.target.value)}
                                />
                                <Input
                                  placeholder="Postcode"
                                  value={item.location.postcode || ''}
                                  onChange={(e) => handleUpdateAddress(itemIndex, 'postcode', e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            {!isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingAddressIndex(itemIndex)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRetryGeocode(itemIndex)}
                                  disabled={isRetryingGeocode}
                                >
                                  {isRetryingGeocode ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Retry"
                                  )}
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    handleRetryGeocode(itemIndex);
                                    setEditingAddressIndex(null);
                                  }}
                                  disabled={isRetryingGeocode}
                                >
                                  {isRetryingGeocode ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingAddressIndex(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Line Items ({lineItems.length})</h3>
              <div className="border rounded-lg overflow-hidden">
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
                    {lineItems.map((item, index) => (
                      <TableRow key={index}>
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
                            item.description
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div 
                              className="font-medium cursor-pointer hover:bg-muted/50 rounded px-1"
                              onClick={() => startEditing(index, 'location_name', item.location.name)}
                            >
                              {editingCell?.rowIndex === index && editingCell?.field === 'location_name' ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                  onBlur={saveEdit}
                                  autoFocus
                                  className="h-7 text-sm"
                                />
                              ) : (
                                item.location.name
                              )}
                            </div>
                            <div 
                              className="text-muted-foreground cursor-pointer hover:bg-muted/50 rounded px-1"
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
                                item.location.address
                              )}
                            </div>
                            {item.location.latitude && item.location.longitude && (
                              <div className="text-xs text-success flex items-center gap-1 mt-1">
                                <Check className="h-3 w-3" />
                                Address validated
                              </div>
                            )}
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
                                // Auto-save after selection
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
                            item.first_generation_date
                          )}
                        </TableCell>
                        <TableCell 
                          className="text-right cursor-pointer hover:bg-muted/50"
                          onClick={() => startEditing(index, 'quantity', item.quantity)}
                        >
                          {editingCell?.rowIndex === index && editingCell?.field === 'quantity' ? (
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
                              step="0.5"
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
                            `$${item.unit_price.toFixed(2)}`
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          ${(item.quantity * item.unit_price).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("upload")} disabled={isProcessing}>
                <X className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleImport} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Import Contract
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
