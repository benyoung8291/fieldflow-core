import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin } from "lucide-react";
import { WorkerFloorPlanViewer } from "@/components/worker/WorkerFloorPlanViewer";
import { WorkerMarkupResponseCard } from "@/components/worker/WorkerMarkupResponseCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export default function WorkerRequestDetails() {
  const { id: appointmentId, ticketId } = useParams();
  const navigate = useNavigate();
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["worker-request-details", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .select(`
          id,
          ticket_number,
          subject,
          status,
          created_at,
          ticket_markups (
            id,
            markup_data,
            notes,
            photo_url,
            status,
            response_notes,
            response_photos,
            floor_plan_id
          )
        `)
        .eq("id", ticketId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });

  const { data: floorPlans } = useQuery({
    queryKey: ["worker-request-floor-plans", ticketId],
    queryFn: async () => {
      if (!ticket?.ticket_markups) return [];

      const floorPlanIds = Array.from(
        new Set(ticket.ticket_markups.map((m: any) => m.floor_plan_id).filter(Boolean))
      ) as string[];

      if (floorPlanIds.length === 0) return [];

      const { data, error } = await supabase
        .from("floor_plans")
        .select("*")
        .in("id", floorPlanIds);

      if (error) throw error;
      return data;
    },
    enabled: !!ticket,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background p-4">
        <p className="text-center text-muted-foreground">Request not found</p>
      </div>
    );
  }

  const pendingCount = ticket.ticket_markups?.filter((m: any) => m.status === "pending").length || 0;
  const completedCount = ticket.ticket_markups?.filter((m: any) => m.status === "completed").length || 0;
  const totalCount = ticket.ticket_markups?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/worker/appointments/${appointmentId}`)}
          className="mb-3"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Appointment
        </Button>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Request #{ticket.ticket_number}</h1>
            <Badge variant="outline">
              {completedCount}/{totalCount} Complete
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{ticket.subject}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Request Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No additional details provided
            </p>
          </CardContent>
        </Card>

        {/* Floor Plans */}
        {floorPlans && floorPlans.length > 0 && floorPlans.map((floorPlan) => {
          const floorPlanMarkups = ticket.ticket_markups?.filter(
            (m: any) => m.floor_plan_id === floorPlan.id
          ) || [];

          return (
            <div key={floorPlan.id} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4" />
                <span>{floorPlan.name}</span>
              </div>

              <WorkerFloorPlanViewer
                floorPlan={floorPlan}
                markups={floorPlanMarkups}
                onMarkupClick={(markup) => {
                  setSelectedMarkupId(markup.id);
                  // Scroll to the markup card
                  setTimeout(() => {
                    document.getElementById(`markup-${markup.id}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 100);
                }}
                selectedMarkupId={selectedMarkupId}
              />
            </div>
          );
        })}

        {/* Markup Response Cards */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            Work Items ({pendingCount} pending)
          </h2>

          {ticket.ticket_markups?.map((markup: any, index: number) => (
            <div key={markup.id} id={`markup-${markup.id}`}>
              <WorkerMarkupResponseCard
                markup={markup}
                index={index}
                ticketId={ticket.id}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
