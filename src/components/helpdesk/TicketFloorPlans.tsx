import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { FloorPlanCard } from "./FloorPlanCard";
import { MarkupResponsePanel } from "./MarkupResponsePanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TicketFloorPlansProps {
  ticketId: string;
}

export function TicketFloorPlans({ ticketId }: TicketFloorPlansProps) {
  // Fetch ticket markups and floor plans
  const { data: markupsData, isLoading } = useQuery({
    queryKey: ["ticket-markups", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_markups")
        .select(`
          *,
          floor_plan:floor_plans(
            id,
            name,
            file_url,
            image_url,
            customer_location_id
          )
        `)
        .eq("ticket_id", ticketId);

      if (error) throw error;
      return data;
    },
  });


  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </Card>
    );
  }

  if (!markupsData || markupsData.length === 0) {
    return null; // Don't show anything if no floor plans
  }

  // Group markups by floor plan
  const floorPlanGroups = markupsData.reduce((acc, markup) => {
    const floorPlanId = markup.floor_plan?.id;
    if (!floorPlanId) return acc;
    
    if (!acc[floorPlanId]) {
      acc[floorPlanId] = {
        floorPlan: markup.floor_plan,
        markups: [],
      };
    }
    acc[floorPlanId].markups.push(markup);
    return acc;
  }, {} as Record<string, any>);

  return (
    <ResizablePanelGroup direction="vertical" className="min-h-[600px]">
      <ResizablePanel defaultSize={60} minSize={30}>
        <ScrollArea className="h-full">
          <div className="space-y-4 p-4">
            {Object.values(floorPlanGroups).map((group: any) => (
              <FloorPlanCard
                key={group.floorPlan.id}
                floorPlan={group.floorPlan}
                markups={group.markups}
              />
            ))}
          </div>
        </ScrollArea>
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={40} minSize={20}>
        <ScrollArea className="h-full">
          <div className="p-4">
            <MarkupResponsePanel
              markups={markupsData || []}
              ticketId={ticketId}
              onResponseSubmitted={() => {
                // Refetch markups after response submitted
              }}
            />
          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
