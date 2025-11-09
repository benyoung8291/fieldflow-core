import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, Edit, Plus, ExternalLink } from "lucide-react";
import CustomerLocationDialog from "./CustomerLocationDialog";

interface CustomerLocationsTabProps {
  customerId: string;
  tenantId: string;
}

export default function CustomerLocationsTab({ customerId, tenantId }: CustomerLocationsTabProps) {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Locations</h3>
        <Button onClick={handleAdd} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      </div>

      {locations && locations.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">No locations added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {locations?.map((location: any) => (
            <Card key={location.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 
                        className="font-semibold hover:text-primary cursor-pointer"
                        onClick={() => navigate(`/customer-locations/${location.id}`)}
                      >
                        {location.name}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => navigate(`/customer-locations/${location.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      {location.is_primary && (
                        <Badge variant="secondary">Primary</Badge>
                      )}
                      {!location.is_active && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {location.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            {location.address}
                            {(location.city || location.state || location.postcode) && (
                              <div>
                                {[location.city, location.state, location.postcode]
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {location.contact_name && (
                        <div className="text-muted-foreground">
                          Contact: {location.contact_name}
                        </div>
                      )}

                      {location.contact_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {location.contact_phone}
                        </div>
                      )}

                      {location.contact_email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {location.contact_email}
                        </div>
                      )}

                      {location.location_notes && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          {location.location_notes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(location)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CustomerLocationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        customerId={customerId}
        tenantId={tenantId}
        location={selectedLocation}
      />
    </div>
  );
}
