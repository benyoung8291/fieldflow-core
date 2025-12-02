import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SelectWithSearch } from "@/components/ui/select-with-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MoveLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: any;
  currentCustomerId: string;
  onMoveComplete: () => void;
}

export default function MoveLocationDialog({
  open,
  onOpenChange,
  location,
  currentCustomerId,
  onMoveComplete,
}: MoveLocationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetCustomerId, setTargetCustomerId] = useState<string>("");
  const [isMoving, setIsMoving] = useState(false);

  // Reset target when dialog opens
  useEffect(() => {
    if (open) {
      setTargetCustomerId("");
    }
  }, [open]);

  // Fetch all customers for selection
  const { data: customers = [] } = useQuery({
    queryKey: ["customers-for-move"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Check for linked service orders (blocking)
  const { data: serviceOrderCount = 0, isLoading: loadingServiceOrders } = useQuery({
    queryKey: ["location-service-orders", location?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("service_orders")
        .select("id", { count: "exact", head: true })
        .eq("location_id", location.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: open && !!location?.id,
  });

  // Check for linked contract line items (informational)
  const { data: contractLineItemCount = 0 } = useQuery({
    queryKey: ["location-contract-line-items", location?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("service_contract_line_items")
        .select("id", { count: "exact", head: true })
        .eq("location_id", location.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: open && !!location?.id,
  });

  // Check for linked floor plans (informational)
  const { data: floorPlanCount = 0 } = useQuery({
    queryKey: ["location-floor-plans", location?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("location_floor_plans")
        .select("id", { count: "exact", head: true })
        .eq("location_id", location.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: open && !!location?.id,
  });

  const customerOptions = customers
    .filter((c) => c.id !== currentCustomerId)
    .map((c) => ({
      value: c.id,
      label: c.name,
    }));

  const canMove = serviceOrderCount === 0;
  const hasLinkedRecords = contractLineItemCount > 0 || floorPlanCount > 0;

  const handleMove = async () => {
    if (!targetCustomerId || !location?.id) return;

    setIsMoving(true);
    try {
      const { error } = await supabase
        .from("customer_locations")
        .update({
          customer_id: targetCustomerId,
          is_primary: false,
          site_contact_id: null,
          facility_manager_contact_id: null,
        })
        .eq("id", location.id);

      if (error) throw error;

      toast({
        title: "Location Moved",
        description: `"${location.name}" has been moved to the new customer account.`,
      });

      queryClient.invalidateQueries({ queryKey: ["customer-locations"] });
      onMoveComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to move location",
        variant: "destructive",
      });
    } finally {
      setIsMoving(false);
    }
  };

  if (!location) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Move Location</DialogTitle>
          <DialogDescription>
            Move "{location.name}" to a different customer account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Location info */}
          <div className="rounded-md border p-3 bg-muted/50">
            <p className="font-medium">{location.name}</p>
            {location.address && (
              <p className="text-sm text-muted-foreground">{location.address}</p>
            )}
            {(location.city || location.state || location.postcode) && (
              <p className="text-sm text-muted-foreground">
                {[location.city, location.state, location.postcode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </div>

          {/* Service orders blocking message */}
          {!loadingServiceOrders && serviceOrderCount > 0 && (
            <Alert variant="destructive">
              <Ban className="h-4 w-4" />
              <AlertTitle>Cannot Move Location</AlertTitle>
              <AlertDescription>
                This location has {serviceOrderCount} linked service order
                {serviceOrderCount > 1 ? "s" : ""}. You must reassign or complete
                these service orders before moving the location.
              </AlertDescription>
            </Alert>
          )}

          {/* Can move - show customer selector */}
          {canMove && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Move to Customer</label>
                <SelectWithSearch
                  value={targetCustomerId}
                  onValueChange={setTargetCustomerId}
                  options={customerOptions}
                  placeholder="Select target customer..."
                  searchPlaceholder="Search customers..."
                  emptyText="No customers found"
                />
              </div>

              {/* Informational warnings */}
              {hasLinkedRecords && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Linked Records</AlertTitle>
                  <AlertDescription className="space-y-1">
                    {floorPlanCount > 0 && (
                      <p>• {floorPlanCount} floor plan{floorPlanCount > 1 ? "s" : ""} will move with this location</p>
                    )}
                    {contractLineItemCount > 0 && (
                      <p>• {contractLineItemCount} contract line item{contractLineItemCount > 1 ? "s" : ""} will remain linked</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {targetCustomerId && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Primary status will be cleared</li>
                      <li>Site contact and facility manager links will be removed</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!canMove || !targetCustomerId || isMoving}
          >
            {isMoving ? "Moving..." : "Move Location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
