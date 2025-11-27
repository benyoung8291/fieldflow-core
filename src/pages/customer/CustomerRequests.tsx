import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CustomerRequests() {
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

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["customer-tickets", profile?.customer_id],
    queryFn: async () => {
      if (!profile?.customer_id) return [];

      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select(`
          *,
          pipeline:helpdesk_pipelines(name, color),
          appointment:appointments(
            id, 
            start_time, 
            end_time, 
            status, 
            completion_reported_at, 
            completion_notes
          )
        `)
        .eq("customer_id", profile.customer_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
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
      case "todo":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted/50 text-muted-foreground border-border/40";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "medium":
        return "bg-warning/10 text-warning border-warning/20";
      case "low":
        return "bg-success/10 text-success border-success/20";
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
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My Requests</h1>
          <p className="text-base text-muted-foreground">
            Track your service requests and their status
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !tickets || tickets.length === 0 ? (
          <Card className="border-border/40 bg-card/50">
            <CardContent className="py-16 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Requests Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Visit a location's floor plan to create your first service request
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket: any) => (
              <Card 
                key={ticket.id} 
                className="border-border/40 hover-lift card-interactive overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Status & Priority Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge 
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-semibold border",
                            getStatusColor(ticket.status)
                          )}
                        >
                          {formatStatus(ticket.status)}
                        </Badge>
                        {ticket.priority && (
                          <Badge 
                            className={cn(
                              "rounded-lg px-3 py-1 text-xs font-semibold border",
                              getPriorityColor(ticket.priority)
                            )}
                          >
                            {ticket.priority.toUpperCase()}
                          </Badge>
                        )}
                        {ticket.appointment && (
                          <Badge variant="outline" className="rounded-lg">
                            Scheduled
                          </Badge>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-base leading-tight line-clamp-2">
                          {ticket.subject}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Request #{ticket.ticket_number}
                        </p>
                      </div>

                      {/* Meta Information */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(ticket.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        {ticket.appointment?.start_time && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              Scheduled {new Date(ticket.appointment.start_time).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Completion Information */}
                      {ticket.appointment?.completion_reported_at && (
                        <div className="mt-3 p-3 bg-success/5 border border-success/20 rounded-lg space-y-2">
                          <div className="flex items-center gap-2 text-success">
                            <div className="h-2 w-2 rounded-full bg-success" />
                            <span className="text-xs font-semibold">Work Completed</span>
                          </div>
                          {ticket.appointment.completion_notes && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {ticket.appointment.completion_notes}
                            </p>
                          )}
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
