import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MapPin, Phone, Mail, Edit, Plus, ExternalLink, Navigation, FileUp, Archive, Merge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CustomerLocationDialog from "./CustomerLocationDialog";
import ImportLocationsDialog from "./ImportLocationsDialog";
import MergeLocationsDialog from "./MergeLocationsDialog";
import GeocodeProgressDialog from "./GeocodeProgressDialog";
import { geocodeCustomerLocationsWithProgress, type LocationProgress } from "@/utils/geocodeCustomerLocations";

interface CustomerLocationsTabProps {
  customerId: string;
  tenantId: string;
}

export default function CustomerLocationsTab({ customerId, tenantId }: CustomerLocationsTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [isGeocodingLocations, setIsGeocodingLocations] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [geocodeProgress, setGeocodeProgress] = useState<LocationProgress[]>([]);
  const [geocodeCurrentIndex, setGeocodeCurrentIndex] = useState(0);
  const [showGeocodeDialog, setShowGeocodeDialog] = useState(false);
  const [geocodeComplete, setGeocodeComplete] = useState(false);

  const { data: locations } = useQuery({
    queryKey: ["customer-locations", customerId, showArchived],
    queryFn: async () => {
      let query = supabase
        .from("customer_locations")
        .select("*")
        .eq("customer_id", customerId);
      
      if (!showArchived) {
        query = query.eq("archived", false);
      }
      
      const { data } = await query
        .order("is_primary", { ascending: false })
        .order("name");
      return data || [];
    },
  });

  const handleEdit = (location: any) => {
    setSelectedLocation(location);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedLocation(null);
    setIsDialogOpen(true);
  };

  const handleGeocodeLocations = async () => {
    setIsGeocodingLocations(true);
    setShowGeocodeDialog(true);
    setGeocodeComplete(false);
    setGeocodeProgress([]);
    setGeocodeCurrentIndex(0);

    try {
      await geocodeCustomerLocationsWithProgress(customerId, {
        onProgress: (locations, currentIndex) => {
          setGeocodeProgress([...locations]);
          setGeocodeCurrentIndex(currentIndex);
        },
        onLocationNeedsConfirmation: async (locationId, error) => {
          // Set the location as needing confirmation
          setGeocodeProgress(prev => 
            prev.map(loc => 
              loc.id === locationId 
                ? { ...loc, needsConfirmation: true, error }
                : loc
            )
          );

          // Wait for user decision
          return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
              setGeocodeProgress(prev => {
                const loc = prev.find(l => l.id === locationId);
                if (loc && !loc.needsConfirmation) {
                  clearInterval(checkInterval);
                  resolve(loc.status !== 'skipped');
                }
                return prev;
              });
            }, 100);
          });
        }
      });

      setGeocodeComplete(true);
      queryClient.invalidateQueries({ queryKey: ["customer-locations", customerId, showArchived] });
    } catch (error) {
      // Error handling is done in the utility function
    } finally {
      setIsGeocodingLocations(false);
    }
  };

  const handleConfirmLocation = (locationId: string) => {
    setGeocodeProgress(prev =>
      prev.map(loc =>
        loc.id === locationId
          ? { ...loc, needsConfirmation: false, status: 'processing' as const }
          : loc
      )
    );
  };

  const handleSkipLocation = (locationId: string) => {
    setGeocodeProgress(prev =>
      prev.map(loc =>
        loc.id === locationId
          ? { ...loc, needsConfirmation: false, status: 'skipped' as const }
          : loc
      )
    );
  };

  const handleArchiveLocation = async (locationId: string) => {
    try {
      const { error } = await supabase
        .from("customer_locations")
        .update({ archived: true })
        .eq("id", locationId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Location archived successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["customer-locations", customerId, showArchived] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to archive location",
        variant: "destructive",
      });
    }
  };

  const handleMergeClick = () => {
    if (selectedForMerge.length !== 2) {
      toast({
        title: "Invalid Selection",
        description: "Please select exactly 2 locations to merge",
        variant: "destructive",
      });
      return;
    }
    setIsMergeDialogOpen(true);
  };

  const handleMergeComplete = () => {
    setSelectedForMerge([]);
    queryClient.invalidateQueries({ queryKey: ["customer-locations", customerId, showArchived] });
  };

  const toggleLocationSelection = (locationId: string) => {
    setSelectedForMerge((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId]
    );
  };

  const location1 = locations?.find((loc) => loc.id === selectedForMerge[0]);
  const location2 = locations?.find((loc) => loc.id === selectedForMerge[1]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Locations</h3>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-archived"
              checked={showArchived}
              onCheckedChange={(checked) => setShowArchived(checked as boolean)}
            />
            <Label htmlFor="show-archived" className="text-sm cursor-pointer">
              Show archived
            </Label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleMergeClick}
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={selectedForMerge.length !== 2}
          >
            <Merge className="h-4 w-4" />
            Merge ({selectedForMerge.length}/2)
          </Button>
          <Button 
            onClick={handleGeocodeLocations} 
            size="sm" 
            variant="outline"
            className="gap-2"
            disabled={isGeocodingLocations}
          >
            <Navigation className="h-4 w-4" />
            {isGeocodingLocations ? "Geocoding..." : "Geocode All"}
          </Button>
          <Button 
            onClick={() => setIsImportDialogOpen(true)} 
            size="sm" 
            variant="outline"
            className="gap-2"
          >
            <FileUp className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={handleAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Location
          </Button>
        </div>
      </div>

      {locations && locations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No locations added yet</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Coordinates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations?.map((location: any) => (
                <TableRow key={location.id} className={location.archived ? "opacity-50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedForMerge.includes(location.id)}
                      onCheckedChange={() => toggleLocationSelection(location.id)}
                      disabled={location.archived}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-medium hover:text-primary cursor-pointer"
                        onClick={() => navigate(`/customer-locations/${location.id}`)}
                      >
                        {location.name}
                      </span>
                      {location.is_primary && (
                        <Badge variant="secondary" className="text-xs">Primary</Badge>
                      )}
                    </div>
                    {location.customer_location_id && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ID: {location.customer_location_id}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {location.address && <div>{location.address}</div>}
                      {(location.city || location.state || location.postcode) && (
                        <div className="text-muted-foreground">
                          {[location.city, location.state, location.postcode]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {location.contact_name && (
                        <div>{location.contact_name}</div>
                      )}
                      {location.contact_phone && (
                        <div className="text-muted-foreground">{location.contact_phone}</div>
                      )}
                      {location.contact_email && (
                        <div className="text-muted-foreground">{location.contact_email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {location.latitude && location.longitude ? (
                      <div className="text-xs text-muted-foreground">
                        <div>Lat: {location.latitude.toFixed(6)}</div>
                        <div>Lng: {location.longitude.toFixed(6)}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not geocoded</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {location.archived ? (
                      <Badge variant="outline">Archived</Badge>
                    ) : location.is_active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/customer-locations/${location.id}`)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(location)}
                        disabled={location.archived}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!location.archived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchiveLocation(location.id)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CustomerLocationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        customerId={customerId}
        tenantId={tenantId}
        location={selectedLocation}
      />

      <ImportLocationsDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        customerId={customerId}
      />

      <MergeLocationsDialog
        open={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        location1={location1}
        location2={location2}
        onMergeComplete={handleMergeComplete}
      />

      <GeocodeProgressDialog
        open={showGeocodeDialog}
        onOpenChange={setShowGeocodeDialog}
        locations={geocodeProgress}
        currentIndex={geocodeCurrentIndex}
        onConfirmLocation={handleConfirmLocation}
        onSkipLocation={handleSkipLocation}
        isComplete={geocodeComplete}
      />
    </div>
  );
}
