import { useState, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, User, MapPin, Building2, Search, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [customerSearch, setCustomerSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");

  // Reset selections when dialog opens with new report
  useEffect(() => {
    if (open && report) {
      setSelectedCustomerId("");
      setSelectedLocationId("");
      setCustomerSearch("");
      setLocationSearch("");
    }
  }, [open, report?.id]);

  // Fetch customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
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
  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ["locations-for-mapping", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const { data, error } = await supabase
        .from("customer_locations")
        .select("id, name, address")
        .eq("customer_id", selectedCustomerId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomerId,
  });

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(search));
  }, [customers, customerSearch]);

  // Filter locations by search
  const filteredLocations = useMemo(() => {
    if (!locationSearch.trim()) return locations;
    const search = locationSearch.toLowerCase();
    return locations.filter(l => 
      l.name.toLowerCase().includes(search) || 
      l.address?.toLowerCase().includes(search)
    );
  }, [locations, locationSearch]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedLocation = locations.find(l => l.id === selectedLocationId);

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
    setLocationSearch("");
  }, [selectedCustomerId]);

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
              <div className="flex items-start gap-2 text-sm bg-yellow-50 dark:bg-yellow-900/20 -mx-4 -mb-2 p-3 mt-2 border-t">
                <MapPin className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Location entered by contractor:</span>
                  <p className="text-foreground font-medium">"{report.manual_location_entry}"</p>
                </div>
              </div>
            )}
          </div>

          {/* Customer Selection with Search */}
          <div className="space-y-2">
            <Label>Customer</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[150px] border rounded-md">
              {loadingCustomers ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No customers found
                </div>
              ) : (
                <div className="p-1">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left",
                        selectedCustomerId === customer.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{customer.name}</span>
                      {selectedCustomerId === customer.id && (
                        <Check className="h-4 w-4 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            {selectedCustomer && (
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedCustomer.name}</span>
              </p>
            )}
          </div>

          {/* Location Selection with Search */}
          <div className="space-y-2">
            <Label>Location</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={selectedCustomerId ? "Search locations..." : "Select customer first"}
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="pl-9"
                disabled={!selectedCustomerId}
              />
            </div>
            <ScrollArea className="h-[150px] border rounded-md">
              {!selectedCustomerId ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Select a customer first
                </div>
              ) : loadingLocations ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No locations found
                </div>
              ) : (
                <div className="p-1">
                  {filteredLocations.map((location) => (
                    <button
                      key={location.id}
                      onClick={() => setSelectedLocationId(location.id)}
                      className={cn(
                        "w-full flex items-start gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left",
                        selectedLocationId === location.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                    >
                      <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{location.name}</p>
                        {location.address && (
                          <p className={cn(
                            "text-xs truncate",
                            selectedLocationId === location.id
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}>
                            {location.address}
                          </p>
                        )}
                      </div>
                      {selectedLocationId === location.id && (
                        <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            {selectedLocation && (
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedLocation.name}</span>
              </p>
            )}
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
