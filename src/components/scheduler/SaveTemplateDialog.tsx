import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentData?: any;
  type: "appointment" | "service-order";
}

export default function SaveTemplateDialog({
  open,
  onOpenChange,
  appointmentData,
  type,
}: SaveTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const saveTemplate = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.user.id)
        .single();

      if (type === "appointment") {
        const duration = appointmentData?.start_time && appointmentData?.end_time
          ? (new Date(appointmentData.end_time).getTime() - new Date(appointmentData.start_time).getTime()) / (1000 * 60 * 60)
          : 2;

        const { error } = await supabase.from("appointment_templates").insert({
          tenant_id: profile?.tenant_id,
          created_by: user.user.id,
          name,
          description,
          duration_hours: duration,
          location_address: appointmentData?.location_address || null,
          location_lat: appointmentData?.location_lat || null,
          location_lng: appointmentData?.location_lng || null,
          gps_check_in_radius: appointmentData?.gps_check_in_radius || 100,
          notes: appointmentData?.notes || null,
          is_recurring: appointmentData?.is_recurring || false,
          recurrence_pattern: appointmentData?.recurrence_pattern || null,
          recurrence_frequency: appointmentData?.recurrence_frequency || null,
          recurrence_days_of_week: appointmentData?.recurrence_days_of_week || null,
        });

        if (error) throw error;
      }

      // Service order template logic would go here if needed
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-templates"] });
      queryClient.invalidateQueries({ queryKey: ["service-order-templates"] });
      toast.success("Template saved successfully");
      onOpenChange(false);
      setName("");
      setDescription("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save template");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Save as {type === "appointment" ? "Appointment" : "Service Order"} Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekly Maintenance Visit"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this template"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveTemplate.mutate()}
              disabled={!name || saveTemplate.isPending}
            >
              {saveTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
