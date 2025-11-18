import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, Edit, Plus, ExternalLink, Navigation, FileUp } from "lucide-react";
import CustomerLocationDialog from "./CustomerLocationDialog";
import ImportLocationsDialog from "./ImportLocationsDialog";
import { geocodeCustomerLocations } from "@/utils/geocodeCustomerLocations";

interface CustomerLocationsTabProps {
  customerId: string;
  tenantId: string;
}

export default function CustomerLocationsTab({ customerId, tenantId }: CustomerLocationsTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [isGeocodingLocations, setIsGeocodingLocations] = useState(false);

  const { data: locations } = useQuery({
    queryKey: ["customer-locations", customerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_locations")
        .select("*")
        .eq("customer_id", customerId)
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
    try {
      await geocodeCustomerLocations(customerId);
      queryClient.invalidateQueries({ queryKey: ["customer-locations", customerId] });
    } catch (error) {
      // Error handling is done in the utility function
    } finally {
      setIsGeocodingLocations(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Locations</h3>
        <div className="flex gap-2">
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
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Coordinates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations?.map((location: any) => (
                <TableRow key={location.id}>
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
                    {location.is_active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
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
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
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
    </div>
  );
}
