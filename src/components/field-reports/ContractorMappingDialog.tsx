import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Phone, User, MapPin, Building2 } from "lucide-react";

interface ContractorMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: {
    id: string;
    report_number: string;
    manual_location_entry: string | null;
    contractor_phone: string | null;
    contractor_name: string | null;
  } | null;
}

export function ContractorMappingDialog({
  open,
  onOpenChange,
  report,
}: ContractorMappingDialogProps) {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  // Reset selections when dialog opens with new report
  useEffect(() => {
    if (open && report) {
      setSelectedCustomerId("");
      setSelectedLocationId("");
    }
  }, [open, report?.id]);

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ["customers-for-mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch locations for selected customer
  const { data: locations = [] } = useQuery({
    queryKey: ["locations-for-mapping", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const { data, error } = await supabase
        .from("customer_locations")
        .select("id, name")
        .eq("customer_id", selectedCustomerId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomerId,
  });

  const saveMapping = useMutation({
    mutationFn: async () => {
      if (!report || !selectedCustomerId || !selectedLocationId) {
        throw new Error("Please select both customer and location");
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("field_reports")
        .update({
          customer_id: selectedCustomerId,
          location_id: selectedLocationId,
          needs_customer_mapping: false,
          mapped_by: user?.id,
          mapped_at: new Date().toISOString(),
          status: "contractor_submitted",
        })
        .eq("id", report.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-reports"] });
      toast.success("Report mapped successfully");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to map report");
    },
  });

  // Reset location when customer changes
  useEffect(() => {
    setSelectedLocationId("");
  }, [selectedCustomerId]);

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Map Contractor Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Report Info */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{report.report_number}</Badge>
            </div>
            
            {report.contractor_name && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{report.contractor_name}</span>
              </div>
            )}
            
            {report.contractor_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{report.contractor_phone}</span>
              </div>
            )}
            
            {report.manual_location_entry && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-foreground font-medium">
                  "{report.manual_location_entry}"
                </span>
              </div>
            )}
          </div>

          {/* Customer Selection */}
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select
              value={selectedCustomerId}
              onValueChange={setSelectedCustomerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {customer.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location Selection */}
          <div className="space-y-2">
            <Label>Location</Label>
            <Select
              value={selectedLocationId}
              onValueChange={setSelectedLocationId}
              disabled={!selectedCustomerId}
            >
              <SelectTrigger>
                <SelectValue 
                  placeholder={
                    selectedCustomerId 
                      ? "Select location..." 
                      : "Select customer first"
                  } 
                />
              </SelectTrigger>
              <SelectContent>
                {locations.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No locations found for this customer
                  </div>
                ) : (
                  locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {location.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMapping.mutate()}
            disabled={!selectedCustomerId || !selectedLocationId || saveMapping.isPending}
          >
            {saveMapping.isPending ? "Saving..." : "Save Mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
