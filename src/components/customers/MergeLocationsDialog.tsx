import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface MergeLocationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location1: any;
  location2: any;
  onMergeComplete: () => void;
}

export default function MergeLocationsDialog({
  open,
  onOpenChange,
  location1,
  location2,
  onMergeComplete,
}: MergeLocationsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Record<string, string>>({
    name: location1?.id || "",
    address: location1?.id || "",
    city: location1?.id || "",
    state: location1?.id || "",
    postcode: location1?.id || "",
    contact_name: location1?.id || "",
    contact_phone: location1?.id || "",
    contact_email: location1?.id || "",
    latitude: location1?.id || "",
    longitude: location1?.id || "",
    location_notes: location1?.id || "",
    customer_location_id: location1?.id || "",
  });

  const fields = [
    { key: "name", label: "Name" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "postcode", label: "Postcode" },
    { key: "contact_name", label: "Contact Name" },
    { key: "contact_phone", label: "Contact Phone" },
    { key: "contact_email", label: "Contact Email" },
    { key: "latitude", label: "Latitude" },
    { key: "longitude", label: "Longitude" },
    { key: "location_notes", label: "Notes" },
    { key: "customer_location_id", label: "Location ID" },
  ];

  const handleMerge = async () => {
    if (!location1 || !location2) return;

    setLoading(true);
    try {
      // Build merged data object from selected fields
      const mergedData: any = {};
      Object.entries(selectedFields).forEach(([field, selectedLocationId]) => {
        const sourceLocation = selectedLocationId === location1.id ? location1 : location2;
        mergedData[field] = sourceLocation[field];
      });

      // Keep the target location as location1, merge location2 into it
      const { data, error } = await supabase.functions.invoke('merge-customer-locations', {
        body: {
          sourceLocationId: location2.id,
          targetLocationId: location1.id,
          mergedData,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Locations merged successfully. All related documents have been relinked.",
      });

      onMergeComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error merging locations:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to merge locations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!location1 || !location2) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Merge Locations</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select which values to keep for each field. Location "{location1.name}" will be kept,
            and "{location2.name}" will be archived. All related documents will be relinked.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[200px_1fr_1fr] gap-4">
            {/* Header Row */}
            <div className="font-semibold text-sm sticky top-0 bg-background z-10 py-2">
              Field
            </div>
            <div className="font-semibold text-sm sticky top-0 bg-background z-10 py-2 border-l pl-4">
              {location1.name}
            </div>
            <div className="font-semibold text-sm sticky top-0 bg-background z-10 py-2 border-l pl-4">
              {location2.name}
            </div>

            {/* Field Rows */}
            {fields.map((field) => {
              const value1 = location1[field.key];
              const value2 = location2[field.key];

              // Skip if both values are empty
              if (!value1 && !value2) return null;

              return (
                <>
                  <div key={`${field.key}-label`} className="text-sm font-medium py-3 flex items-start">
                    {field.label}
                  </div>
                  <div key={`${field.key}-1`} className="border-l pl-4 py-3">
                    <button
                      onClick={() =>
                        setSelectedFields((prev) => ({ ...prev, [field.key]: location1.id }))
                      }
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedFields[field.key] === location1.id
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-muted/50 border-2 border-transparent hover:border-muted-foreground/20"
                      }`}
                    >
                      {value1 || <span className="text-muted-foreground italic">Empty</span>}
                    </button>
                  </div>
                  <div key={`${field.key}-2`} className="border-l pl-4 py-3">
                    <button
                      onClick={() =>
                        setSelectedFields((prev) => ({ ...prev, [field.key]: location2.id }))
                      }
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedFields[field.key] === location2.id
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-muted/50 border-2 border-transparent hover:border-muted-foreground/20"
                      }`}
                    >
                      {value2 || <span className="text-muted-foreground italic">Empty</span>}
                    </button>
                  </div>
                </>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Merge Locations
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
