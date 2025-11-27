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
import { FloorPlanMarkupList } from "@/components/customer/FloorPlanMarkupList";
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
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);

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
        .eq("customer_location_id", locationId!);

      if (error) throw error;
      
      // Generate signed URLs for PDFs to avoid CORS issues
      const plansWithSignedUrls = await Promise.all(
        (data || []).map(async (plan) => {
          if (plan.file_path) {
            const { data: signedUrl, error: signError } = await supabase
              .storage
              .from("floor-plans")
              .createSignedUrl(plan.file_path, 3600); // 1 hour expiry
            
            if (signError) {
              console.error("Error creating signed URL:", signError);
              return plan;
            }
            
            return { ...plan, signed_url: signedUrl.signedUrl };
          }
          return plan;
        })
      );
      
      return plansWithSignedUrls as Array<typeof data[0] & { signed_url?: string }>;
    },
    enabled: !!locationId,
  });

  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("customer_portal_users")
        .select("customer_id, tenant_id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Get Requests pipeline ID
  const { data: requestsPipeline } = useQuery({
    queryKey: ["requests-pipeline", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;
      
      const { data, error } = await supabase
        .from("helpdesk_pipelines")
        .select("id")
        .eq("tenant_id", profile.tenant_id)
        .eq("name", "Requests")
        .single();

      if (error) {
        console.error("Error fetching Requests pipeline:", error);
        return null;
      }
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.customer_id || !profile?.tenant_id || !requestsPipeline?.id) {
        throw new Error("Missing required information");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create helpdesk ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("helpdesk_tickets")
        .insert([{
          subject: `${taskTitle} - ${location?.name}`,
          customer_id: profile.customer_id,
          tenant_id: profile.tenant_id,
          pipeline_id: requestsPipeline.id,
          status: "new",
          priority: "medium",
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create markups
      const markupInserts = markups.map((markup) => {
        if (markup.type === "pin") {
          return {
            ticket_id: ticket.id,
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
          const centerX = markup.bounds.x + markup.bounds.width / 2;
          const centerY = markup.bounds.y + markup.bounds.height / 2;
          return {
            ticket_id: ticket.id,
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
        .from("ticket_markups")
        .insert(markupInserts as any);

      if (markupError) throw markupError;

      return ticket;
    },
    onSuccess: () => {
      toast.success("Request created successfully!");
      queryClient.invalidateQueries({ queryKey: ["customer-tickets"] });
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

  const updateMarkupNote = (id: string, notes: string) => {
    setMarkups((prev) =>
      prev.map((m) => (m.id === id ? { ...m, notes } : m))
    );
  };

  const deleteMarkup = (id: string) => {
    setMarkups((prev) => prev.filter((m) => m.id !== id));
    setSelectedMarkupId(null);
    toast.success("Markup deleted");
  };

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
                     <CardTitle>
                       {plan.floor_number ? `${plan.floor_number} ${plan.name}` : plan.name}
                     </CardTitle>
                   </CardHeader>
                   <CardContent>
                     <Button className="w-full">View & Mark Up</Button>
                   </CardContent>
                 </Card>
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4">
            {/* Floor Plan Viewer */}
            <Card className="h-[calc(100vh-12rem)]">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>
                  {selectedFloorPlan?.floor_number 
                    ? `${selectedFloorPlan.floor_number} ${selectedFloorPlan.name}` 
                    : selectedFloorPlan?.name}
                </CardTitle>
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
                   pdfUrl={selectedFloorPlan?.signed_url || selectedFloorPlan?.file_url || ""}
                   markups={markups}
                   onMarkupsChange={setMarkups}
                   mode={mode}
                   onModeChange={setMode}
                 />
              </CardContent>
            </Card>

            {/* Markup List Sidebar */}
            <Card className="h-fit lg:h-[calc(100vh-12rem)] overflow-auto">
              <CardHeader>
                <CardTitle className="text-lg">Markup List</CardTitle>
              </CardHeader>
              <CardContent>
                <FloorPlanMarkupList
                  markups={markups}
                  onMarkupUpdate={updateMarkupNote}
                  onMarkupDelete={deleteMarkup}
                  selectedMarkupId={selectedMarkupId}
                  onMarkupSelect={setSelectedMarkupId}
                />
              </CardContent>
            </Card>
          </div>
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
                onClick={() => createRequestMutation.mutate()}
                disabled={!taskTitle || createRequestMutation.isPending}
              >
                {createRequestMutation.isPending ? (
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
