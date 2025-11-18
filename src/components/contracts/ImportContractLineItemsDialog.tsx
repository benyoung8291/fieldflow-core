import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface ImportContractLineItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  customerId: string;
}

export default function ImportContractLineItemsDialog({
  open,
  onOpenChange,
  contractId,
  customerId,
}: ImportContractLineItemsDialogProps) {
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
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

      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const lineItems = results.data.map((row: any, index: number) => {
              // Find location by name or customer_location_id
              const location = locations?.find(
                (loc) =>
                  loc.name === row.location_name ||
                  loc.customer_location_id === row.location_id
              );

              return {
                tenant_id: profile.tenant_id,
                contract_id: contractId,
                description: row.description || "",
                quantity: parseFloat(row.quantity) || 1,
                unit_price: parseFloat(row.unit_price) || 0,
                line_total: parseFloat(row.line_total) || parseFloat(row.quantity) * parseFloat(row.unit_price) || 0,
                estimated_hours: parseFloat(row.estimated_hours) || 0,
                recurrence_frequency: row.frequency?.toLowerCase() || "monthly",
                first_generation_date: row.first_date || new Date().toISOString().split("T")[0],
                next_generation_date: row.next_date || row.first_date || new Date().toISOString().split("T")[0],
                location_id: location?.id || null,
                key_number: row.key_number || null,
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
            onOpenChange(false);
            setSelectedFile(null);
          } catch (error: any) {
            console.error("Import error:", error);
            toast.error("Failed to import line items", {
              description: error.message,
            });
          } finally {
            setIsImporting(false);
          }
        },
        error: (error) => {
          console.error("Parse error:", error);
          toast.error("Failed to parse CSV file");
          setIsImporting(false);
        },
      });
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Failed to import line items", {
        description: error.message,
      });
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Contract Line Items</DialogTitle>
          <DialogDescription>
            Upload a CSV file with contract line items. Required columns: description, quantity, unit_price, estimated_hours, frequency, first_date.
            Optional: location_name, location_id, key_number, line_total, next_date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>CSV File</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                disabled={isImporting}
              />
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <p className="font-medium">CSV Format Guide:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>description: Service description</li>
              <li>quantity: Number of units</li>
              <li>unit_price: Price per unit</li>
              <li>estimated_hours: Hours required</li>
              <li>frequency: weekly, fortnightly, monthly, quarterly, yearly, one_time</li>
              <li>first_date: First generation date (YYYY-MM-DD)</li>
              <li>location_name or location_id: Match existing location</li>
              <li>key_number: Optional key reference</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedFile(null);
            }}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting || !selectedFile}>
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
