import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Calendar, MapPin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CustomerFieldReports() {
  const navigate = useNavigate();
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("customer_portal_users")
        .select("customer_id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: fieldReports, isLoading } = useQuery({
    queryKey: ["customer-field-reports", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("field_reports")
        .select(`
          *,
          appointment:appointments!inner(
            id,
            title,
            start_time,
            service_order:service_orders!inner(
              id,
              work_order_number,
              customer_id,
              location:customer_locations!service_orders_location_id_fkey(name, address)
            )
          )
        `)
        .eq("status", "approved")
        .eq("appointment.service_order.customer_id", profile.customer_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching field reports:", error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!profile?.customer_id,
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-success/10 text-success border-success/20";
      case "pending_approval":
        return "bg-warning/10 text-warning border-warning/20";
      case "draft":
        return "bg-muted/50 text-muted-foreground border-border/40";
      default:
        return "bg-muted/50 text-muted-foreground border-border/40";
    }
  };

  const formatStatus = (status: string) => {
    return status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown";
  };

  return (
    <CustomerPortalLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Field Reports</h1>
          <p className="text-base text-muted-foreground">
            View completed work documentation and reports
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !fieldReports || fieldReports.length === 0 ? (
          <Card className="border-border/40 bg-card/50">
            <CardContent className="py-16 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Field Reports Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Field reports will appear here after work is completed
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {fieldReports.map((report: any) => (
              <Card 
                key={report.id} 
                onClick={() => navigate(`/customer/field-reports/${report.id}`)}
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
                            getStatusColor(report.status)
                          )}
                        >
                          {formatStatus(report.status)}
                        </Badge>
                        {report.pdf_url && (
                          <Badge variant="outline" className="rounded-lg">
                            PDF Available
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-base leading-tight">
                          Report #{report.report_number}
                        </h3>
                        {report.appointment?.title && (
                          <p className="text-sm text-muted-foreground">
                            {report.appointment.title}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>
                            {report.appointment?.service_order?.location?.name || 'Unknown Location'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(report.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>

                      {report.pdf_url && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(report.pdf_url, '_blank')}
                            className="rounded-lg"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                            View Report
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CustomerPortalLayout>
  );
}
