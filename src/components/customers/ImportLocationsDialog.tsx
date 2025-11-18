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

interface ImportLocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
}

export default function ImportLocationsDialog({
  open,
  onOpenChange,
  customerId,
}: ImportLocationsDialogProps) {
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

  const geocodeAddress = async (address: string, city?: string, state?: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const fullAddress = [address, city, state].filter(Boolean).join(", ");
      const response = await supabase.functions.invoke("places-autocomplete", {
        body: { input: fullAddress },
      });

      if (response.error || !response.data?.predictions?.[0]) {
        return null;
      }

      const placeId = response.data.predictions[0].place_id;
      const detailsResponse = await supabase.functions.invoke("places-details", {
        body: { placeId },
      });

      if (detailsResponse.error || !detailsResponse.data?.result?.geometry?.location) {
        return null;
      }

      return {
        lat: detailsResponse.data.result.geometry.location.lat,
        lng: detailsResponse.data.result.geometry.location.lng,
      };
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
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

      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const locationsToImport = results.data;
            const importedCount = { success: 0, failed: 0 };

            // Process locations in batches for geocoding
            for (const row of locationsToImport as any[]) {
              try {
                // First, insert the location without coordinates
                const locationData = {
                  tenant_id: profile.tenant_id,
                  customer_id: customerId,
                  name: row.name || "",
                  address: row.address || "",
                  city: row.city || "",
                  state: row.state || "",
                  postcode: row.postcode || "",
                  customer_location_id: row.location_id || row.customer_location_id || null,
                  contact_name: row.contact_name || null,
                  contact_phone: row.contact_phone || null,
                  contact_email: row.contact_email || null,
                  location_notes: row.notes || null,
                  is_primary: false,
                  is_active: true,
                  latitude: null,
                  longitude: null,
                };

                const { data: newLocation, error: insertError } = await supabase
                  .from("customer_locations")
                  .insert(locationData)
                  .select()
                  .single();

                if (insertError) {
                  console.error("Insert error:", insertError);
                  importedCount.failed++;
                  continue;
                }

                importedCount.success++;

                // Geocode in background (don't await)
                if (row.address) {
                  geocodeAddress(row.address, row.city, row.state).then((coords) => {
                    if (coords && newLocation) {
                      supabase
                        .from("customer_locations")
                        .update({
                          latitude: coords.lat,
                          longitude: coords.lng,
                        })
                        .eq("id", newLocation.id)
                        .then(() => {
                          console.log(`Geocoded location: ${newLocation.name}`);
                        });
                    }
                  });
                }
              } catch (error) {
                console.error("Location import error:", error);
                importedCount.failed++;
              }
            }

            toast.success(
              `Imported ${importedCount.success} locations successfully`,
              {
                description: importedCount.failed > 0 
                  ? `${importedCount.failed} failed. Geocoding in background.`
                  : "Geocoding addresses in background.",
              }
            );

            queryClient.invalidateQueries({ queryKey: ["customer-locations", customerId] });
            onOpenChange(false);
            setSelectedFile(null);
          } catch (error: any) {
            console.error("Import error:", error);
            toast.error("Failed to import locations", {
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
      toast.error("Failed to import locations", {
        description: error.message,
      });
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Customer Locations</DialogTitle>
          <DialogDescription>
            Upload a CSV file with customer locations. Required columns: name, address.
            Optional: city, state, postcode, location_id, contact_name, contact_phone, contact_email, notes.
            Addresses will be validated and geocoded automatically in the background.
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
              <li>name: Location name (required)</li>
              <li>address: Street address (required)</li>
              <li>city: City name</li>
              <li>state: State/Province</li>
              <li>postcode: Postal code</li>
              <li>location_id: Customer's location ID</li>
              <li>contact_name: On-site contact</li>
              <li>contact_phone: Contact phone</li>
              <li>contact_email: Contact email</li>
              <li>notes: Additional notes</li>
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
