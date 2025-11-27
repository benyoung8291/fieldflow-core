import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FloorPlanViewer, Markup, MarkupType } from "@/components/customer/FloorPlanViewer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function LocationFloorPlans() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [mode, setMode] = useState<MarkupType>("pin");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");

  const { data: location } = useQuery({
    queryKey: ["customer-location", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("*")
        .eq("id", locationId!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!locationId,
  });

  const { data: floorPlans, isLoading } = useQuery({
    queryKey: ["floor-plans", locationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("floor_plans")
        .select("*")
        .eq("location_id", locationId!);

      if (error) throw error;
      return data;
    },
    enabled: !!locationId,
  });

  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("customer_id, tenant_id")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.customer_id || !profile?.tenant_id) {
        throw new Error("Missing customer or tenant information");
      }

      // Create task
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert([{
          title: taskTitle,
          description: taskDescription,
          customer_id: profile.customer_id,
          tenant_id: profile.tenant_id,
          status: "pending",
          priority: "medium",
          created_by: user.id,
        }])
        .select()
        .single();

      if (taskError) throw taskError;

      // Create markups
      const markupInserts = markups.map((markup) => {
        if (markup.type === "pin") {
          return {
            task_id: task.id,
            floor_plan_id: selectedPlan!,
            tenant_id: profile.tenant_id,
            pin_x: markup.x,
            pin_y: markup.y,
            markup_data: {
              type: "pin",
              notes: markup.notes,
            },
          };
        } else {
          // For zones, store center point in pin_x/pin_y and full bounds in markup_data
          const centerX = markup.bounds.x + markup.bounds.width / 2;
          const centerY = markup.bounds.y + markup.bounds.height / 2;
          return {
            task_id: task.id,
            floor_plan_id: selectedPlan!,
            tenant_id: profile.tenant_id,
            pin_x: centerX,
            pin_y: centerY,
            markup_data: {
              type: "zone",
              bounds: markup.bounds,
              notes: markup.notes,
            },
          };
        }
      });

      const { error: markupError } = await supabase
        .from("task_markups")
        .insert(markupInserts as any);

      if (markupError) throw markupError;

      return task;
    },
    onSuccess: () => {
      toast.success("Request created successfully!");
      queryClient.invalidateQueries({ queryKey: ["customer-tasks"] });
      setShowCreateDialog(false);
      setMarkups([]);
      setTaskTitle("");
      setTaskDescription("");
      navigate("/customer/requests");
    },
    onError: (error) => {
      console.error("Failed to create request:", error);
      toast.error("Failed to create request");
    },
  });

  const selectedFloorPlan = floorPlans?.find((p) => p.id === selectedPlan);

  return (
    <CustomerPortalLayout>
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/customer/locations")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{location?.name}</h1>
            <p className="text-muted-foreground">Floor Plans</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !selectedPlan ? (
          floorPlans && floorPlans.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Floor Plans</h3>
                <p className="text-muted-foreground">
                  Contact support to add floor plans for this location
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {floorPlans?.map((plan) => (
                <Card key={plan.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPlan(plan.id)}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">View & Mark Up</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="h-[calc(100vh-12rem)]">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>{selectedFloorPlan?.name}</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedPlan(null);
                    setMarkups([]);
                  }}
                >
                  Back to Plans
                </Button>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  disabled={markups.length === 0}
                >
                  Create Request ({markups.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="h-[calc(100%-5rem)]">
              <FloorPlanViewer
                pdfUrl={selectedFloorPlan?.file_url || ""}
                markups={markups}
                onMarkupsChange={setMarkups}
                mode={mode}
                onModeChange={setMode}
              />
            </CardContent>
          </Card>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Maintenance Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Brief description of the issue"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Detailed description of what needs to be done"
                  rows={4}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {markups.length} markup(s) will be included with this request
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createTaskMutation.mutate()}
                disabled={!taskTitle || createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Request"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CustomerPortalLayout>
  );
}
