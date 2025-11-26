import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useAppointmentConfirmations } from "@/hooks/useAppointmentConfirmations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NotifyWorkersButtonProps {
  appointmentId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function NotifyWorkersButton({ appointmentId, variant = "outline", size = "sm" }: NotifyWorkersButtonProps) {
  const { notifyWorkers, isNotifying, confirmations } = useAppointmentConfirmations(appointmentId);

  const { data: workers = [] } = useQuery({
    queryKey: ["appointment-workers", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_workers")
        .select("worker_id")
        .eq("appointment_id", appointmentId);

      if (error) throw error;
      return data || [];
    },
  });

  const pendingConfirmations = confirmations.filter(c => c.status === "pending");
  const hasPendingConfirmations = pendingConfirmations.length > 0;

  if (workers.length === 0) return null;

  const handleNotify = () => {
    const workerIds = workers.map(w => w.worker_id);
    notifyWorkers({ appointmentId, workerIds });
  };

  const tooltipText = hasPendingConfirmations
    ? `Notify ${pendingConfirmations.length} worker${pendingConfirmations.length > 1 ? 's' : ''} to confirm`
    : "All workers have confirmed";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={handleNotify}
            disabled={!hasPendingConfirmations || isNotifying}
          >
            <Bell className="h-4 w-4 mr-1" />
            {isNotifying ? "Notifying..." : "Notify Workers"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
