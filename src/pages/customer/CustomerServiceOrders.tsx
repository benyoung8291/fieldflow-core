import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ClipboardList, Calendar, MapPin, Clock, Users, FileEdit, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import React from "react";

export default function CustomerServiceOrders() {
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("Customer portal: User not authenticated");
        throw new Error("Not authenticated");
      }

      console.log("Customer portal: Fetching profile for user", user.id);
      const { data, error } = await supabase
        .from("customer_portal_users")
        .select("customer_id")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Customer portal: Error fetching profile", error);
        throw error;
      }
      console.log("Customer portal: Profile loaded", data);
      return data;
    },
  });

  const { data: serviceOrders, isLoading } = useQuery({
    queryKey: ["customer-service-orders", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) {
        console.log("Customer portal: No customer_id, returning empty array");
        return [];
      }

      console.log("Customer portal: Fetching service orders for customer", profile.customer_id);
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          *,
          location:customer_locations!service_orders_customer_location_id_fkey(name, address),
          appointments:appointments(
            id,
            tickets:helpdesk_tickets(
              id,
              ticket_markups(id)
            )
          )
        `)
        .eq("customer_id", profile.customer_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Customer portal: Error fetching service orders", error);
        throw error;
      }
      console.log("Customer portal: Service orders loaded", data);
      
      // Calculate counts for each service order
      return data?.map((order: any) => ({
        ...order,
        appointmentCount: order.appointments?.length || 0,
        markupCount: order.appointments?.reduce((total: number, apt: any) => 
          total + (apt.tickets?.reduce((t: number, ticket: any) => 
            t + (ticket.ticket_markups?.length || 0), 0) || 0), 0) || 0
      }));
    },
    enabled: !!profile?.customer_id,
  });

  const { data: futureContractItems, isLoading: futureItemsLoading } = useQuery({
    queryKey: ["customer-future-contract-items", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      console.log("Customer portal: Fetching future contract line items");
      const { data, error } = await supabase
        .from("service_contract_line_items")
        .select(`
          *,
          contract:service_contracts!inner(
            customer_id,
            contract_number,
            title,
            status
          ),
          location:customer_locations(name, address)
        `)
        .eq("contract.customer_id", profile.customer_id)
        .eq("contract.status", "active")
        .eq("is_active", true)
        .not("next_generation_date", "is", null)
        .gte("next_generation_date", new Date().toISOString().split('T')[0])
        .order("next_generation_date", { ascending: true });

      if (error) {
        console.error("Customer portal: Error fetching future contract items", error);
        throw error;
      }
      console.log("Customer portal: Future contract items loaded", data);
      return data;
    },
    enabled: !!profile?.customer_id,
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "in_progress":
        return "bg-info/10 text-info border-info/20";
      case "pending":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted/50 text-muted-foreground border-border/40";
    }
  };

  const formatStatus = (status: string) => {
    return status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown";
  };

  // Group future contract items by location and date (same as generation logic)
  const groupedFutureOrders = React.useMemo(() => {
    if (!futureContractItems || futureContractItems.length === 0) return [];

    const grouped = new Map<string, {
      date: string;
      locationId: string;
      locationName: string;
      locationAddress: string;
      items: any[];
      totalAmount: number;
      totalHours: number;
    }>();

    futureContractItems.forEach((item: any) => {
      // Create key from location + date combination
      const key = `${item.customer_location_id}_${item.next_generation_date}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: item.next_generation_date,
          locationId: item.customer_location_id,
          locationName: item.location?.name || 'Unknown Location',
          locationAddress: item.location?.address || '',
          items: [],
          totalAmount: 0,
          totalHours: 0,
        });
      }

      const group = grouped.get(key)!;
      group.items.push(item);
      group.totalAmount += item.line_total || 0;
      group.totalHours += item.estimated_hours || 0;
    });

    // Convert map to array and sort by date
    return Array.from(grouped.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [futureContractItems]);

  return (
    <CustomerPortalLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Service Orders</h1>
          <p className="text-base text-muted-foreground">
            View all service orders for your locations
          </p>
        </div>

        {isLoading || futureItemsLoading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (!serviceOrders || serviceOrders.length === 0) && (!futureContractItems || futureContractItems.length === 0) ? (
          <Card className="border-border/40 bg-card/50">
            <CardContent className="py-16 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <ClipboardList className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Service Orders Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Service orders will appear here once they are created for your locations
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Active Service Orders */}
            {serviceOrders && serviceOrders.length > 0 && (
              <div className="space-y-3">
                {futureContractItems && futureContractItems.length > 0 && (
                  <h2 className="text-lg font-semibold text-muted-foreground">Active Service Orders</h2>
                )}
                {serviceOrders.map((order: any) => (
              <Card 
                key={order.id}
                onClick={() => navigate(`/customer/service-orders/${order.id}`)}
                className="border-border/40 hover-lift card-interactive overflow-hidden group cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge 
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-semibold border",
                            getStatusColor(order.status)
                          )}
                        >
                          {formatStatus(order.status)}
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-base leading-tight">
                          {order.title || `Order #${order.order_number}`}
                        </h3>
                        {order.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {order.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{order.location?.name || 'Unknown Location'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(order.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        {order.appointmentCount > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            <span>{order.appointmentCount} appointment{order.appointmentCount !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {order.markupCount > 0 && (
                          <div className="flex items-center gap-1.5">
                            <FileEdit className="h-3.5 w-3.5" />
                            <span>{order.markupCount} markup{order.markupCount !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
              </div>
            )}

            {/* Future Scheduled Service Orders from Contracts */}
            {groupedFutureOrders && groupedFutureOrders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Scheduled Future Services
                </h2>
                {groupedFutureOrders.map((group, index) => (
                  <Card 
                    key={`${group.locationId}_${group.date}_${index}`}
                    className="border-border/40 bg-accent/5 hover-lift overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <CardContent className="p-5">
                      <div className="space-y-4">
                        {/* Header with location and date */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge 
                                className="rounded-lg px-3 py-1 text-xs font-semibold border bg-accent/20 text-accent-foreground border-accent/30"
                              >
                                Scheduled Service
                              </Badge>
                              {group.items.length > 1 && (
                                <Badge 
                                  variant="outline"
                                  className="rounded-lg px-3 py-1 text-xs font-semibold"
                                >
                                  <Package className="h-3 w-3 mr-1" />
                                  {group.items.length} Line Items
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{group.locationName}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>
                                  Scheduled: {new Date(group.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                              {group.totalHours > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{group.totalHours.toFixed(1)} hours</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Line items */}
                        <div className="space-y-2 pl-4 border-l-2 border-accent/30">
                          {group.items.map((item: any, itemIndex: number) => (
                            <div key={item.id} className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium leading-tight">
                                    {item.description}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.contract?.contract_number} - {item.contract?.title}
                                  </p>
                                  {item.recurrence_frequency && (
                                    <Badge 
                                      variant="outline" 
                                      className="mt-1 text-xs"
                                    >
                                      {item.recurrence_frequency}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right text-sm shrink-0">
                                  <p className="font-semibold">${item.line_total?.toFixed(2) || '0.00'}</p>
                                  {item.estimated_hours > 0 && (
                                    <p className="text-xs text-muted-foreground">{item.estimated_hours}h</p>
                                  )}
                                </div>
                              </div>
                              {itemIndex < group.items.length - 1 && (
                                <div className="h-px bg-border/40 my-2" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Total */}
                        {group.items.length > 1 && (
                          <div className="flex items-center justify-between pt-3 border-t border-border/60">
                            <span className="text-sm font-semibold">Total</span>
                            <span className="text-base font-bold">${group.totalAmount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </CustomerPortalLayout>
  );
}
