import { useParams, useNavigate } from "react-router-dom";
import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerProfile } from "@/hooks/useCustomerProfile";
import { ArrowLeft, Loader2, Calendar, MapPin, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileFloorPlanViewer } from "@/components/customer/MobileFloorPlanViewer";

export default function RequestView() {
  const { requestId } = useParams();
  const navigate = useNavigate();

  const { data: profile } = useCustomerProfile();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["customer-ticket", requestId],
    queryFn: async () => {
      if (!requestId) return null;

      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select(`
          *,
          pipeline:helpdesk_pipelines(name, color),
          appointment:appointments(
            id,
            title,
            start_time,
            end_time,
            status,
            completion_reported_at,
            completion_notes,
            service_order:service_orders(
              id,
              work_order_number,
              location:customer_locations!customer_location_id(name, address)
            )
          ),
          messages:helpdesk_messages(
            id,
            body,
            created_at,
            is_from_customer
          )
        `)
        .eq("id", requestId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });

  const { data: markups } = useQuery({
    queryKey: ["ticket-markups", requestId],
    queryFn: async () => {
      if (!requestId) return [];

      const { data, error } = await supabase
        .from("ticket_markups")
        .select(`
          *,
          floor_plan:floor_plans(
            id,
            name,
            floor_number,
            file_url,
            image_url
          ),
          completed_by_user:profiles!ticket_markups_completed_by_fkey(first_name, last_name)
        `)
        .eq("ticket_id", requestId);

      if (error) throw error;

      // Reconstruct full markup objects from stored data
      const reconstructedMarkups = data?.map((m: any) => {
        const markupData = m.markup_data || {};
        
        if (markupData.type === "pin") {
          return {
            ...m,
            markup_data: {
              id: m.id,
              type: "pin" as const,
              x: m.pin_x,
              y: m.pin_y,
              notes: markupData.notes,
            }
          };
        } else {
          return {
            ...m,
            markup_data: {
              id: m.id,
              type: "zone" as const,
              bounds: markupData.bounds,
              notes: markupData.notes,
            }
          };
        }
      }) || [];

      return reconstructedMarkups;
    },
    enabled: !!requestId,
  });

  const { data: fieldReport } = useQuery({
    queryKey: ["ticket-field-report", ticket?.appointment?.id],
    queryFn: async () => {
      if (!ticket?.appointment?.id) return null;

      const { data, error } = await supabase
        .from("field_reports")
        .select("*")
        .eq("appointment_id", ticket.appointment.id)
        .eq("status", "approved")
        .maybeSingle();

      if (error) {
        console.error("Error fetching field report:", error);
        return null;
      }
      return data;
    },
    enabled: !!ticket?.appointment?.id,
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

  if (isLoading) {
    return (
      <CustomerPortalLayout>
        <div className="flex justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CustomerPortalLayout>
    );
  }

  if (!ticket) {
    return (
      <CustomerPortalLayout>
        <Card>
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Request Not Found</h3>
            <Button onClick={() => navigate("/customer/requests")}>
              Back to Requests
            </Button>
          </CardContent>
        </Card>
      </CustomerPortalLayout>
    );
  }

  return (
    <CustomerPortalLayout>
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/customer/requests")}
          className="rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Requests
        </Button>

        {/* Request Details */}
        <Card className="border-border/40">
          <CardHeader className="space-y-4">
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
            </div>
            <div>
              <CardTitle className="text-2xl">{ticket.subject}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Request #{ticket.ticket_number}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>
                  Created {new Date(ticket.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {ticket.messages && ticket.messages.length > 0 && (
              <div className="pt-4 border-t space-y-2">
                <h4 className="font-semibold text-sm">Description</h4>
                {ticket.messages
                  .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((msg: any) => (
                    <p key={msg.id} className="text-sm text-muted-foreground">
                      {msg.body}
                    </p>
                  ))
                }
              </div>
            )}
          </CardContent>
        </Card>

        {/* Floor Plan Markups */}
        {markups && markups.length > 0 && (() => {
          // Group markups by floor plan
          const floorPlanGroups = markups.reduce((acc: any, markup: any) => {
            const floorPlanId = markup.floor_plan_id;
            if (!acc[floorPlanId]) {
              acc[floorPlanId] = {
                floorPlan: markup.floor_plan,
                markups: []
              };
            }
            acc[floorPlanId].markups.push(markup);
            return acc;
          }, {});

          return Object.entries(floorPlanGroups).map(([floorPlanId, group]: [string, any]) => (
            <Card key={floorPlanId} className="border-border/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">
                    {group.floorPlan?.floor_number && `${group.floorPlan.floor_number} - `}
                    {group.floorPlan?.name}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Floor Plan Viewer */}
                <div className="h-[500px] rounded-lg overflow-hidden border border-border/40">
                  <MobileFloorPlanViewer
                    pdfUrl={group.floorPlan?.file_url || ""}
                    imageUrl={group.floorPlan?.image_url}
                    markups={group.markups.map((m: any) => m.markup_data)}
                    onMarkupsChange={() => {}}
                    readOnly={true}
                  />
                </div>

                {/* Worker Responses */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Work Completed</h4>
                  {group.markups.map((markup: any, index: number) => {
                    const hasResponse = markup.response_notes || (markup.response_photos && Array.isArray(markup.response_photos) && markup.response_photos.length > 0);
                    
                    if (!hasResponse) return null;

                    return (
                      <div key={markup.id} className="p-4 bg-muted/30 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {markup.markup_data?.type === "pin" ? "📍 Pin" : "🔲 Zone"} #{index + 1}
                          </Badge>
                          {(markup as any).status === "completed" && (
                            <Badge className="bg-success/10 text-success border-success/20 text-xs">
                              Completed
                            </Badge>
                          )}
                        </div>

                        {/* Your Original Request */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Your Request:</p>
                          <p className="text-sm">{markup.notes || "No notes provided"}</p>
                          {markup.photo_url && (
                            <img
                              src={markup.photo_url}
                              alt="Customer photo"
                              className="w-full max-h-48 object-contain rounded border mt-2"
                            />
                          )}
                        </div>

                        {/* Worker's Response */}
                        {markup.response_notes && (
                          <div className="space-y-1.5 pt-2 border-t">
                            <p className="text-xs font-medium text-muted-foreground">Our Response:</p>
                            <p className="text-sm">{markup.response_notes}</p>
                          </div>
                        )}

                        {/* Worker's Photos */}
                        {markup.response_photos && Array.isArray(markup.response_photos) && markup.response_photos.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Completion Photos ({markup.response_photos.length}):
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {markup.response_photos.map((photoUrl: string, photoIndex: number) => (
                                <img
                                  key={photoIndex}
                                  src={photoUrl}
                                  alt={`Completion photo ${photoIndex + 1}`}
                                  className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(photoUrl, '_blank')}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Completed By */}
                        {markup.completed_by_user && (
                          <div className="text-xs text-muted-foreground pt-2 border-t">
                            Completed by {markup.completed_by_user.first_name} {markup.completed_by_user.last_name}
                            {markup.completed_at && ` on ${new Date(markup.completed_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ));
        })()}

        {/* Appointment Details */}
        {ticket.appointment && (
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Scheduled Appointment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {new Date(ticket.appointment.start_time).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(ticket.appointment.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  })} - {new Date(ticket.appointment.end_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </div>
              </div>

              {ticket.appointment.service_order?.location && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">{ticket.appointment.service_order.location.name}</p>
                    {ticket.appointment.service_order.location.address && (
                      <p className="text-muted-foreground">{ticket.appointment.service_order.location.address}</p>
                    )}
                  </div>
                </div>
              )}

              {ticket.appointment.completion_reported_at && (
                <div className="mt-4 p-4 bg-success/5 border border-success/20 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-success">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-sm font-semibold">Work Completed</span>
                  </div>
                  {ticket.appointment.completion_notes && (
                    <p className="text-sm text-muted-foreground">
                      {ticket.appointment.completion_notes}
                    </p>
                  )}
                </div>
              )}

              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/customer/appointments/${ticket.appointment.id}`)}
                  className="rounded-lg"
                >
                  View Full Appointment
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Field Report */}
        {fieldReport && (
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Completion Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">Report #{fieldReport.report_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(fieldReport.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <Badge className="bg-success/10 text-success border-success/20">
                  Approved
                </Badge>
              </div>

              <div className="flex gap-2">
                {fieldReport.pdf_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(fieldReport.pdf_url, '_blank')}
                    className="rounded-lg"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View PDF Report
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => navigate(`/customer/field-reports/${fieldReport.id}`)}
                  className="rounded-lg"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Full Report
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </CustomerPortalLayout>
  );
}
