import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, FileText, Clock, ClipboardList, Calendar } from "lucide-react";

export default function CustomerDashboard() {
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("customer_portal_users")
        .select("*, customers(*)")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["customer-locations", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("customer_locations")
        .select("*")
        .eq("customer_id", profile.customer_id)
        .eq("archived", false);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.customer_id,
  });

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ["customer-requests-count", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select("id, status, created_at")
        .eq("customer_id", profile.customer_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.customer_id,
  });

  const { data: serviceOrders, isLoading: serviceOrdersLoading } = useQuery({
    queryKey: ["customer-service-orders-count", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("service_orders")
        .select("id, status")
        .eq("customer_id", profile.customer_id);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.customer_id,
  });

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["customer-appointments-count", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          status,
          start_time,
          service_order:service_orders!inner(customer_id)
        `);

      if (error) throw error;
      return data?.filter((apt: any) => apt.service_order?.customer_id === profile.customer_id) || [];
    },
    enabled: !!profile?.customer_id,
  });

  const { data: fieldReports, isLoading: fieldReportsLoading } = useQuery({
    queryKey: ["customer-field-reports-count", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("field_reports")
        .select(`
          id,
          status,
          appointment:appointments(
            service_order:service_orders(customer_id)
          )
        `);

      if (error) throw error;
      return data?.filter((report: any) => 
        report.appointment?.service_order?.customer_id === profile.customer_id
      ) || [];
    },
    enabled: !!profile?.customer_id,
  });

  const openRequests = requests?.filter(req => req.status !== 'completed') || [];
  const activeServiceOrders = serviceOrders?.filter(so => so.status === 'in_progress') || [];
  const upcomingAppointments = appointments?.filter((apt: any) => 
    new Date(apt.start_time) > new Date() && apt.status === 'scheduled'
  ) || [];
  const recentReports = fieldReports?.slice(0, 5) || [];
  const recentRequests = requests?.slice(0, 5) || [];

  return (
    <CustomerPortalLayout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome Back
          </h1>
          <p className="text-lg text-muted-foreground">
            {profile?.customers?.name || "Loading..."}
          </p>
        </div>

        {/* Stats Cards - Compact for mobile, full-featured for desktop */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover-lift overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-primary/5 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 md:pb-3 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Locations
              </CardTitle>
              <div className="rounded-full bg-primary/10 p-1.5 md:p-2">
                <MapPin className="h-3 w-3 md:h-4 md:w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              {locationsLoading ? (
                <Loader2 className="h-5 w-5 md:h-7 md:w-7 animate-spin text-primary" />
              ) : (
                <div className="text-2xl md:text-3xl font-bold tracking-tight">
                  {locations?.length || 0}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover-lift overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-warning/5 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 md:pb-3 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Requests
              </CardTitle>
              <div className="rounded-full bg-warning/10 p-1.5 md:p-2">
                <FileText className="h-3 w-3 md:h-4 md:w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              {requestsLoading ? (
                <Loader2 className="h-5 w-5 md:h-7 md:w-7 animate-spin text-warning" />
              ) : (
                <div className="text-2xl md:text-3xl font-bold tracking-tight">
                  {openRequests.length}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover-lift overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-info/5 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 md:pb-3 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Orders
              </CardTitle>
              <div className="rounded-full bg-info/10 p-1.5 md:p-2">
                <ClipboardList className="h-3 w-3 md:h-4 md:w-4 text-info" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              {serviceOrdersLoading ? (
                <Loader2 className="h-5 w-5 md:h-7 md:w-7 animate-spin text-info" />
              ) : (
                <div className="text-2xl md:text-3xl font-bold tracking-tight">
                  {activeServiceOrders.length}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover-lift overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-success/5 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 md:pb-3 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                Upcoming
              </CardTitle>
              <div className="rounded-full bg-success/10 p-1.5 md:p-2">
                <Calendar className="h-3 w-3 md:h-4 md:w-4 text-success" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              {appointmentsLoading ? (
                <Loader2 className="h-5 w-5 md:h-7 md:w-7 animate-spin text-success" />
              ) : (
                <div className="text-2xl md:text-3xl font-bold tracking-tight">
                  {upcomingAppointments.length}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 md:space-y-4">
            <h2 className="text-lg md:text-xl font-semibold tracking-tight">Recent Requests</h2>
            {requestsLoading ? (
              <Card className="border-border/40">
                <CardContent className="flex justify-center p-8 md:p-12">
                  <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : recentRequests.length === 0 ? (
              <Card className="border-border/40 bg-card/50">
                <CardContent className="text-center py-8 md:py-12 space-y-2 md:space-y-3 px-4">
                  <div className="mx-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <FileText className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground max-w-sm mx-auto">
                    No requests yet. Visit a location's floor plan to create your first request.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {recentRequests.map((request: any) => (
                  <Card 
                    key={request.id} 
                    className="border-border/40 hover-lift cursor-pointer card-interactive"
                  >
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-start justify-between gap-3 md:gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-medium">Request #{request.id.slice(0, 8)}</p>
                          <time className="text-[10px] md:text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </time>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 md:space-y-4">
            <h2 className="text-lg md:text-xl font-semibold tracking-tight">Recent Field Reports</h2>
            {fieldReportsLoading ? (
              <Card className="border-border/40">
                <CardContent className="flex justify-center p-8 md:p-12">
                  <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : recentReports.length === 0 ? (
              <Card className="border-border/40 bg-card/50">
                <CardContent className="text-center py-8 md:py-12 space-y-2 md:space-y-3 px-4">
                  <div className="mx-auto w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <FileText className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground max-w-sm mx-auto">
                    No reports yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {recentReports.map((report: any) => (
                  <Card 
                    key={report.id} 
                    className="border-border/40 hover-lift cursor-pointer card-interactive"
                  >
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-start justify-between gap-3 md:gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-medium">Report #{report.id.slice(0, 8)}</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground capitalize">
                            {report.status?.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
