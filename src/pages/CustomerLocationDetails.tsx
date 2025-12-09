import { useParams, useNavigate } from "react-router-dom";
import { useLogDetailPageAccess } from "@/hooks/useLogDetailPageAccess";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, MapPin, Phone, Mail, FileText, Calendar, Package, Navigation } from "lucide-react";
import { format, parseISO, isFuture } from "date-fns";
import { geocodeCustomerLocationsWithProgress } from "@/utils/geocodeCustomerLocations";
import { useQueryClient } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { FloorPlansTab } from "@/components/customer-locations/FloorPlansTab";
import { FutureServiceOrdersTab } from "@/components/customer-locations/FutureServiceOrdersTab";
import QuickContactDialog from "@/components/customers/QuickContactDialog";
import { formatCurrency } from "@/lib/utils";
import { UserPlus } from "lucide-react";

export default function CustomerLocationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [contactDialogOpen, setContactDialogOpen] = React.useState(false);
  const [contactRole, setContactRole] = React.useState<"site_contact" | "facility_manager">("site_contact");

  // Log data access for audit trail
  useLogDetailPageAccess('customer_locations', id);

  const { data: location, isLoading: locationLoading } = useQuery({
    queryKey: ["customer-location", id],
    queryFn: async () => {
      const { data: locationData, error: locationError } = await supabase
        .from("customer_locations")
        .select(`
          *,
          site_contact:contacts!customer_locations_site_contact_id_fkey (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          facility_manager_contact:contacts!customer_locations_facility_manager_contact_id_fkey (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (locationError) {
        console.error("Error fetching location:", locationError);
        throw locationError;
      }

      if (!locationData) {
        return null;
      }

      // Fetch customer data separately
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("id, name, email, phone")
        .eq("id", locationData.customer_id)
        .maybeSingle();

      if (customerError) {
        console.error("Error fetching customer:", customerError);
      }

      return {
        ...locationData,
        customers: customerData
      } as any;
    },
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ["location-service-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .eq("customer_location_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching service orders:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  const { data: contractLineItems } = useQuery<any[]>({
    queryKey: ["location-contract-items", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_contract_line_items")
        .select(`
          *,
          service_contracts (
            contract_number,
            title,
            status,
            start_date,
            end_date
          )
        `)
        .eq("location_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const { data: appointments } = useQuery<any[]>({
    queryKey: ["location-appointments", id],
    queryFn: async () => {
      if (!id) return [];
      
      // Appointments are linked to service orders, which are linked to locations
      // First get service orders for this location
      const { data: serviceOrdersData } = await (supabase as any)
        .from("service_orders")
        .select("id")
        .eq("customer_location_id", id);
      
      if (!serviceOrdersData || serviceOrdersData.length === 0) return [];
      
      const serviceOrderIds = serviceOrdersData.map((so: any) => so.id);
      
      const result = await (supabase as any)
        .from("appointments")
        .select("*")
        .in("service_order_id", serviceOrderIds)
        .order("start_time", { ascending: true });

      if (result.error) {
        console.error("Error fetching appointments:", result.error);
        return [];
      }
      
      if (!result.data) return [];

      // Fetch profiles separately to avoid deep type issues
      const appointmentsWithProfiles = await Promise.all(
        result.data.map(async (apt: any) => {
          if (!apt.assigned_to) return { ...apt, profiles: null };
          
          const profileResult = await (supabase as any)
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", apt.assigned_to)
            .single();
          
          return { ...apt, profiles: profileResult.data };
        })
      );

      return appointmentsWithProfiles;
    },
    enabled: !!id,
  });

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    scheduled: "bg-info/10 text-info",
    in_progress: "bg-warning/10 text-warning",
    completed: "bg-success/10 text-success",
    cancelled: "bg-destructive/10 text-destructive",
  };

  const statusLabels: Record<string, string> = {
    draft: "Waiting",
    scheduled: "Scheduled",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  const upcomingAppointments: any[] = appointments?.filter((apt: any) => 
    isFuture(parseISO(apt.start_time))
  ) || [];

  const handleGeocode = async () => {
    if (!id || !location) return;
    
    setIsGeocoding(true);
    try {
      const toastId = toast.loading("Geocoding location...");
      
      await geocodeCustomerLocationsWithProgress(location.customer_id, {
        onProgress: (locations, currentIndex) => {
          const current = locations.find(l => l.id === id);
          if (current?.latitude && current?.longitude) {
            toast.success(
              `Location geocoded: ${current.latitude.toFixed(6)}, ${current.longitude.toFixed(6)}`,
              { id: toastId }
            );
          }
        }
      });
      
      queryClient.invalidateQueries({ queryKey: ['customer-location', id] });
    } catch (error: any) {
      toast.error(`Failed to geocode: ${error.message}`);
    } finally {
      setIsGeocoding(false);
    }
  };

  if (locationLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!location) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <h2 className="text-2xl font-bold mb-2">Location Not Found</h2>
          <p className="text-muted-foreground mb-4">The location you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/customers/${location.customers?.id}`)}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {location.customers?.name}
          </Button>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{location.name}</h1>
              <p className="text-muted-foreground mt-2">
                {location.customers?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!location.latitude && (
                <Button
                  onClick={handleGeocode}
                  disabled={isGeocoding}
                  variant="outline"
                  size="sm"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  {isGeocoding ? "Geocoding..." : "Geocode Location"}
                </Button>
              )}
              {location.is_primary && (
                <Badge variant="secondary">Primary Location</Badge>
              )}
              <Badge variant={location.is_active ? "default" : "outline"}>
                {location.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{serviceOrders?.length || 0}</div>
                  <div className="text-xs text-muted-foreground">Service Orders</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-success" />
                <div>
                  <div className="text-2xl font-bold">{contractLineItems?.length || 0}</div>
                  <div className="text-xs text-muted-foreground">Contract Line Items</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-info" />
                <div>
                  <div className="text-2xl font-bold">{upcomingAppointments.length}</div>
                  <div className="text-xs text-muted-foreground">Upcoming Work</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Location Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {location.customer_location_id && (
                  <div>
                    <div className="text-sm text-muted-foreground">Customer Location ID</div>
                    <div className="font-medium">{location.customer_location_id}</div>
                  </div>
                )}

                {location.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Address</div>
                      <div className="font-medium">
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
                  </div>
                )}

                {location.site_contact && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm text-muted-foreground">Site Contact</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setContactRole("site_contact");
                          setContactDialogOpen(true);
                        }}
                      >
                        <UserPlus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="font-medium">
                      {location.site_contact.first_name} {location.site_contact.last_name}
                    </div>
                    {location.site_contact.email && (
                      <div className="text-sm text-muted-foreground">{location.site_contact.email}</div>
                    )}
                    {location.site_contact.phone && (
                      <div className="text-sm text-muted-foreground">{location.site_contact.phone}</div>
                    )}
                  </div>
                )}

                {!location.site_contact && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm text-muted-foreground">Site Contact</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setContactRole("site_contact");
                          setContactDialogOpen(true);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Contact
                      </Button>
                    </div>
                  </div>
                )}

                {location.facility_manager_contact && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm text-muted-foreground">Facility Manager</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setContactRole("facility_manager");
                          setContactDialogOpen(true);
                        }}
                      >
                        <UserPlus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="font-medium">
                      {location.facility_manager_contact.first_name} {location.facility_manager_contact.last_name}
                    </div>
                    {location.facility_manager_contact.email && (
                      <div className="text-sm text-muted-foreground">{location.facility_manager_contact.email}</div>
                    )}
                    {location.facility_manager_contact.phone && (
                      <div className="text-sm text-muted-foreground">{location.facility_manager_contact.phone}</div>
                    )}
                  </div>
                )}

                {!location.facility_manager_contact && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm text-muted-foreground">Facility Manager</div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setContactRole("facility_manager");
                          setContactDialogOpen(true);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Contact
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {(location.latitude && location.longitude) && (
                  <div>
                    <div className="text-sm text-muted-foreground">Coordinates</div>
                    <div className="font-medium text-xs">
                      <div>Latitude: {location.latitude.toFixed(6)}</div>
                      <div>Longitude: {location.longitude.toFixed(6)}</div>
                    </div>
                  </div>
                )}
              </div>

              {location.location_notes && (
                <div className="col-span-2">
                  <div className="text-sm text-muted-foreground mb-2">Notes</div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">{location.location_notes}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <Tabs defaultValue="service-orders" className="w-full">
            <CardHeader>
              <TabsList>
                <TabsTrigger value="service-orders">Service Orders</TabsTrigger>
                <TabsTrigger value="future-orders">Future Service Orders</TabsTrigger>
                <TabsTrigger value="contracts">Contract Line Items</TabsTrigger>
                <TabsTrigger value="appointments">Scheduled Work</TabsTrigger>
                <TabsTrigger value="floor-plans">Floor Plans</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="service-orders" className="mt-0">
                {!serviceOrders || serviceOrders.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No service orders for this location
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order Number</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Billing Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceOrders.map((order: any) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/service-orders/${order.id}`)}
                        >
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{order.title}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[order.status]}>
                              {order.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{order.billing_type}</TableCell>
                          <TableCell>
                            {order.billing_type === "fixed" 
                              ? formatCurrency(parseFloat(order.fixed_amount || 0))
                              : `${order.estimated_hours || 0}h @ ${formatCurrency(parseFloat(order.hourly_rate || 0))}`
                            }
                          </TableCell>
                          <TableCell>{format(parseISO(order.created_at), "PP")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="future-orders" className="mt-0">
                <FutureServiceOrdersTab contractLineItems={contractLineItems || []} />
              </TabsContent>

              <TabsContent value="contracts" className="mt-0">
                {!contractLineItems || contractLineItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No contract line items for this location
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Next Generation</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contractLineItems.map((item: any) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/service-contracts/${item.contract_id}`)}
                        >
                          <TableCell className="font-medium">
                            {item.service_contracts?.contract_number}
                          </TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.recurrence_frequency}</Badge>
                          </TableCell>
                          <TableCell>
                            {item.next_generation_date 
                              ? format(parseISO(item.next_generation_date), "PP")
                              : "N/A"
                            }
                          </TableCell>
                          <TableCell>{formatCurrency(parseFloat(item.line_total))}</TableCell>
                          <TableCell>
                            <Badge variant={item.is_active ? "default" : "outline"}>
                              {item.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="appointments" className="mt-0">
                {!appointments || appointments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No appointments scheduled for this location
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments.map((apt: any) => {
                        const isPast = !isFuture(parseISO(apt.start_time));
                        return (
                          <TableRow
                            key={apt.id}
                            className={`cursor-pointer hover:bg-muted/50 ${isPast ? "opacity-60" : ""}`}
                            onClick={() => navigate(`/scheduler?appointment=${apt.id}`)}
                          >
                            <TableCell className="font-medium">
                              {format(parseISO(apt.start_time), "PPp")}
                            </TableCell>
                            <TableCell>{apt.title}</TableCell>
                            <TableCell>{apt.description || "—"}</TableCell>
                            <TableCell>
                              {apt.profiles 
                                ? `${apt.profiles.first_name} ${apt.profiles.last_name}`
                                : "Unassigned"
                              }
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[apt.status]}>
                                {apt.status.replace("_", " ")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="floor-plans" className="mt-0">
                <FloorPlansTab locationId={id!} tenantId={location.tenant_id} />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Contact Dialog */}
      <QuickContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        customerId={location.customer_id}
        locationId={id}
        assignAsRole={contactRole}
        onContactCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["customer-location", id] });
          setContactDialogOpen(false);
        }}
      />
    </DashboardLayout>
  );
}
