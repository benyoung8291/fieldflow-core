import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import DraggableServiceOrder from "./DraggableServiceOrder";
import DraggableWorker from "./DraggableWorker";
import { differenceInHours } from "date-fns";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import WorkerSuggestionsDialog from "./WorkerSuggestionsDialog";

interface ServiceOrdersSidebarProps {
  onSelectWorkerForOrder?: (workerId: string, serviceOrderId: string, suggestedDate?: string) => void;
}

export default function ServiceOrdersSidebar({ onSelectWorkerForOrder }: ServiceOrdersSidebarProps) {
  const [showWorkerSuggestions, setShowWorkerSuggestions] = useState(false);
  const [aiServiceOrderId, setAiServiceOrderId] = useState<string>("");
  const [aiServiceOrderTitle, setAiServiceOrderTitle] = useState<string>("");

  const { data: serviceOrdersWithAppointments = [], error } = useQuery({
    queryKey: ["service-orders-with-appointments"],
    queryFn: async () => {
      const { data: orders, error: ordersError } = await supabase
        .from("service_orders")
        .select(`
          *,
          customers!service_orders_customer_id_fkey(name),
          appointments(id, start_time, end_time, status),
          service_order_line_items(description, quantity)
        `)
        .in("status", ["draft", "scheduled", "in_progress"])
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Error fetching service orders:", ordersError);
        throw ordersError;
      }

      // Calculate remaining hours and generate summary for each service order
      return (orders || []).map((order: any) => {
        const estimatedHours = order.estimated_hours || 0;
        
        // Calculate total scheduled hours from appointments
        const scheduledHours = (order.appointments || [])
          .filter((apt: any) => apt.status !== "cancelled")
          .reduce((total: number, apt: any) => {
            const hours = differenceInHours(
              new Date(apt.end_time),
              new Date(apt.start_time)
            );
            return total + hours;
          }, 0);

        const remainingHours = Math.max(0, estimatedHours - scheduledHours);

        // Generate line items summary
        const lineItems = order.service_order_line_items || [];
        const lineItemsSummary = lineItems.length > 0
          ? lineItems
              .slice(0, 3)
              .map((item: any) => `${item.quantity}x ${item.description}`)
              .join(", ") + (lineItems.length > 3 ? "..." : "")
          : "";

        return {
          ...order,
          scheduledHours,
          remainingHours,
          lineItemsSummary,
        };
      });
    },
  });

  // Filter to only show service orders that need more appointments
  const ordersNeedingAppointments = (serviceOrdersWithAppointments || []).filter(
    (order: any) => order.remainingHours > 0
  );

  // Fetch workers with skills
  const { data: workers = [] } = useQuery({
    queryKey: ["workers-with-skills"],
    queryFn: async () => {
      // Get all user_roles with worker role
      const { data: workerRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "worker");

      if (rolesError) throw rolesError;
      
      const workerUserIds = workerRoles?.map(r => r.user_id) || [];
      
      if (workerUserIds.length === 0) return [];

      // Fetch profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, is_active")
        .in("id", workerUserIds)
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      if (profilesError) throw profilesError;

      // Fetch worker skills separately
      const { data: workerSkills } = await supabase
        .from("worker_skills")
        .select(`
          worker_id,
          skill_id,
          proficiency_level,
          skills(name)
        `)
        .in("worker_id", workerUserIds);

      // Combine profiles with their skills
      const workersWithSkills = (profiles || []).map(profile => ({
        ...profile,
        worker_skills: (workerSkills || [])
          .filter(ws => ws.worker_id === profile.id)
          .map(ws => ({
            skill_id: ws.skill_id,
            proficiency_level: ws.proficiency_level,
            skills: ws.skills
          }))
      }));

      return workersWithSkills;
    },
  });

  const handleAISuggest = (order: any) => {
    setAiServiceOrderId(order.id);
    setAiServiceOrderTitle(order.title || order.order_number);
    setShowWorkerSuggestions(true);
  };

  const handleSelectWorker = (workerId: string, suggestedDate?: string) => {
    if (onSelectWorkerForOrder) {
      onSelectWorkerForOrder(workerId, aiServiceOrderId, suggestedDate);
    }
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader className="p-3">
          <CardTitle className="text-sm">
            Service Orders
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Drag to calendar or use AI
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="px-2 pb-2 pt-2">
              <div className="space-y-1.5">
                {ordersNeedingAppointments.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    All service orders scheduled
                  </div>
                ) : (
                  ordersNeedingAppointments.map((order) => (
                    <div key={order.id} className="group relative">
                      <DraggableServiceOrder
                        serviceOrder={order}
                        remainingHours={order.remainingHours}
                        lineItemsSummary={order.lineItemsSummary}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAISuggest(order);
                        }}
                        title="AI Worker Suggestions"
                      >
                        <Sparkles className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <h3 className="text-xs font-semibold px-1">Available Workers</h3>
                <p className="text-[10px] text-muted-foreground px-1 mb-2">
                  Drag to assign to appointments
                </p>
                {workers.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    No workers available
                  </div>
                ) : (
                  workers.map((worker) => (
                    <DraggableWorker key={worker.id} worker={worker} />
                  ))
                )}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <WorkerSuggestionsDialog
        open={showWorkerSuggestions}
        onOpenChange={setShowWorkerSuggestions}
        serviceOrderId={aiServiceOrderId}
        serviceOrderTitle={aiServiceOrderTitle}
        onSelectWorker={handleSelectWorker}
      />
    </>
  );
}
