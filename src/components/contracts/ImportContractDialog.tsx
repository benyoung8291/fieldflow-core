import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Papa from "papaparse";

interface ParsedContract {
  customer: {
    existingCustomerId?: string;
    name: string;
    email?: string;
    abn?: string;
  };
  location: {
    existingLocationId?: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
  contract: {
    title: string;
    description?: string;
    contract_type: "recurring" | "one_time";
    start_date: string;
    end_date?: string;
    billing_frequency: "monthly" | "quarterly" | "annually";
    service_frequency?: "weekly" | "monthly" | "quarterly" | "annually";
    total_amount?: number;
    auto_renew?: boolean;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    frequency?: string;
  }>;
}

interface ImportContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ImportContractDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportContractDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedContracts, setParsedContracts] = useState<ParsedContract[]>([]);
  const [tenantId, setTenantId] = useState<string>("");
  const [stage, setStage] = useState<"upload" | "review" | "importing">("upload");
  const [editingContract, setEditingContract] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseSpreadsheet = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setIsProcessing(true);

    try {
      // Parse CSV/Excel file
      const text = await file.text();
      
      Papa.parse(text, {
        header: true,
        complete: async (results) => {
          console.log("Parsed CSV:", results.data);

          // Send to AI for intelligent parsing
          const { data, error } = await supabase.functions.invoke("parse-contract-spreadsheet", {
            body: { spreadsheetData: results.data },
          });

          if (error) throw error;

          if (data.contracts && data.contracts.length > 0) {
            setParsedContracts(data.contracts);
            setTenantId(data.tenantId);
            setStage("review");
            toast.success(`Parsed ${data.contracts.length} contract(s) from spreadsheet`);
          } else {
            toast.error("No contracts found in spreadsheet");
          }
        },
        error: (error) => {
          console.error("CSV parse error:", error);
          toast.error("Failed to parse spreadsheet");
        },
      });
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process spreadsheet");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (parsedContracts.length === 0) return;

    setStage("importing");

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const contractData of parsedContracts) {
        try {
          let customerId = contractData.customer.existingCustomerId;
          
          // Create customer if doesn't exist
          if (!customerId) {
            const { data: newCustomer, error: customerError } = await supabase
              .from("customers")
              .insert({
                tenant_id: tenantId,
                name: contractData.customer.name,
                email: contractData.customer.email,
                abn: contractData.customer.abn,
              })
              .select()
              .single();

            if (customerError) throw customerError;
            customerId = newCustomer.id;
          }

          let locationId = contractData.location.existingLocationId;
          
          // Create location if doesn't exist
          if (!locationId) {
            const { data: newLocation, error: locationError } = await supabase
              .from("customer_locations")
              .insert({
                tenant_id: tenantId,
                customer_id: customerId,
                name: contractData.location.name,
                address: contractData.location.address,
                city: contractData.location.city,
                state: contractData.location.state,
                postcode: contractData.location.postcode,
              })
              .select()
              .single();

            if (locationError) throw locationError;
            locationId = newLocation.id;
          }

          // Create service contract
          const { data: { user } } = await supabase.auth.getUser();
          
          // Generate contract number
          const { data: latestContract } = await supabase
            .from("service_contracts")
            .select("contract_number")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const lastNumber = latestContract?.contract_number?.match(/\d+$/)?.[0] || "0";
          const newContractNumber = `SC-${String(parseInt(lastNumber) + 1).padStart(5, "0")}`;

          const { data: contract, error: contractError } = await supabase
            .from("service_contracts")
            .insert({
              tenant_id: tenantId,
              customer_id: customerId,
              contract_number: newContractNumber,
              title: contractData.contract.title,
              description: contractData.contract.description,
              start_date: contractData.contract.start_date,
              end_date: contractData.contract.end_date,
              billing_frequency: contractData.contract.billing_frequency,
              status: "draft",
              auto_generate: contractData.contract.auto_renew || false,
              total_contract_value: contractData.contract.total_amount || 0,
              created_by: user?.id,
            })
            .select()
            .single();

          if (contractError) throw contractError;

          // Create line items
          if (contractData.lineItems && contractData.lineItems.length > 0) {
            // Map frequency to correct enum value
            const mapFrequency = (freq?: string): "monthly" | "quarterly" | "annually" | "weekly" | "bi_weekly" | "daily" | "semi_annually" | "one_time" => {
              if (!freq) return "monthly";
              const lowerFreq = freq.toLowerCase();
              if (lowerFreq.includes("month")) return "monthly";
              if (lowerFreq.includes("quarter")) return "quarterly";
              if (lowerFreq.includes("annual") || lowerFreq.includes("year")) return "annually";
              if (lowerFreq.includes("week")) return "weekly";
              if (lowerFreq.includes("bi") && lowerFreq.includes("week")) return "bi_weekly";
              if (lowerFreq.includes("daily") || lowerFreq.includes("day")) return "daily";
              if (lowerFreq.includes("semi")) return "semi_annually";
              return "monthly";
            };

            const lineItemsData = contractData.lineItems.map((item, index) => ({
              contract_id: contract.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.quantity * item.unit_price,
              recurrence_frequency: mapFrequency(item.frequency || contractData.contract.billing_frequency),
              first_generation_date: contractData.contract.start_date,
              next_generation_date: contractData.contract.start_date,
              location_id: locationId,
              item_order: index,
              is_active: true,
            }));

            const { error: lineItemsError } = await supabase
              .from("service_contract_line_items")
              .insert(lineItemsData);

            if (lineItemsError) throw lineItemsError;
          }

          successCount++;
        } catch (error) {
          console.error("Error importing contract:", error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} contract(s)`);
        onSuccess?.();
        onOpenChange(false);
        resetDialog();
      }

      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} contract(s)`);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import contracts");
    } finally {
      setStage("review");
    }
  };

  const resetDialog = () => {
    setFile(null);
    setParsedContracts([]);
    setTenantId("");
    setStage("upload");
    setEditingContract(null);
  };

  const updateContract = (index: number, field: string, value: any) => {
    setParsedContracts(prev => {
      const updated = [...prev];
      const keys = field.split('.');
      let target: any = updated[index];
      for (let i = 0; i < keys.length - 1; i++) {
        target = target[keys[i]];
      }
      target[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const removeContract = (index: number) => {
    setParsedContracts(prev => prev.filter((_, i) => i !== index));
    toast.info("Contract removed from import queue");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Service Contracts from Spreadsheet
          </DialogTitle>
        </DialogHeader>

        {stage === "upload" && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload a CSV or Excel file containing service contract data. The AI will intelligently parse
                and map your data to service contracts, customers, and locations.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="file-upload">Select Spreadsheet</Label>
              <div className="flex gap-2">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
                <Button
                  onClick={parseSpreadsheet}
                  disabled={!file || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Parse
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {stage === "review" && parsedContracts.length > 0 && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Review the parsed data below. You can edit any field or remove contracts before importing.
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {parsedContracts.map((contract, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Contract {index + 1}: {contract.contract.title}
                        </CardTitle>
                        <div className="flex gap-2">
                          {contract.customer.existingCustomerId && (
                            <Badge variant="outline">Existing Customer</Badge>
                          )}
                          {contract.location.existingLocationId && (
                            <Badge variant="outline">Existing Location</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeContract(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Tabs defaultValue="contract">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="contract">Contract</TabsTrigger>
                          <TabsTrigger value="customer">Customer</TabsTrigger>
                          <TabsTrigger value="location">Location</TabsTrigger>
                          <TabsTrigger value="items">Line Items</TabsTrigger>
                        </TabsList>

                        <TabsContent value="contract" className="space-y-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Title</Label>
                              <Input
                                value={contract.contract.title}
                                onChange={(e) => updateContract(index, 'contract.title', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Type</Label>
                              <Input
                                value={contract.contract.contract_type}
                                disabled
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Start Date</Label>
                              <Input
                                type="date"
                                value={contract.contract.start_date}
                                onChange={(e) => updateContract(index, 'contract.start_date', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Billing Frequency</Label>
                              <Input
                                value={contract.contract.billing_frequency}
                                disabled
                                className="text-sm"
                              />
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="customer" className="space-y-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Name</Label>
                              <Input
                                value={contract.customer.name}
                                onChange={(e) => updateContract(index, 'customer.name', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Email</Label>
                              <Input
                                value={contract.customer.email || ''}
                                onChange={(e) => updateContract(index, 'customer.email', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="location" className="space-y-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Name</Label>
                              <Input
                                value={contract.location.name}
                                onChange={(e) => updateContract(index, 'location.name', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Address</Label>
                              <Input
                                value={contract.location.address}
                                onChange={(e) => updateContract(index, 'location.address', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">City</Label>
                              <Input
                                value={contract.location.city || ''}
                                onChange={(e) => updateContract(index, 'location.city', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">State</Label>
                              <Input
                                value={contract.location.state || ''}
                                onChange={(e) => updateContract(index, 'location.state', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="items">
                          <div className="space-y-2">
                            {contract.lineItems.map((item, itemIndex) => (
                              <div key={itemIndex} className="flex gap-2 items-center text-sm p-2 bg-muted rounded">
                                <div className="flex-1">{item.description}</div>
                                <div className="w-20">Qty: {item.quantity}</div>
                                <div className="w-28">${item.unit_price.toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <Separator />

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetDialog}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={parsedContracts.length === 0}>
                Import {parsedContracts.length} Contract(s)
              </Button>
            </div>
          </div>
        )}

        {stage === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Importing contracts...</p>
            <p className="text-sm text-muted-foreground">Please wait while we create your contracts</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
