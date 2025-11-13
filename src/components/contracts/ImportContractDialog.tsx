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
  location: {
    existingLocationId?: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    postcode?: string;
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
  const [step, setStep] = useState<"upload" | "review">("upload");

  // Fetch customers for selection
  const { data: customers } = useQuery({
    queryKey: ["customers-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
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
            // Call edge function to parse with AI
            const { data: functionData, error: functionError } = await supabase.functions.invoke(
              "parse-contract-spreadsheet",
              {
                body: {
                  spreadsheetData: results.data,
                  customerId: customerId,
                },
              }
            );

            if (functionError) throw functionError;

            // Set parsed line items for review
            setLineItems(functionData.lineItems || []);
            setStep("review");

            toast.success(`Found ${functionData.lineItems?.length || 0} line items`);
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
            })
            .select()
            .single();

          if (locationError) throw locationError;
          createdLocationMap.set(locationKey, newLocation.id);
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
          item_order: index,
          is_active: true,
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

            <div>
              <h3 className="font-semibold mb-2">Line Items ({lineItems.length})</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{item.location.name}</div>
                            <div className="text-muted-foreground">{item.location.address}</div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{item.recurrence_frequency}</TableCell>
                        <TableCell>{item.first_generation_date}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
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
