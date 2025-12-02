import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FloorPlanViewer, Markup, MarkupType } from "@/components/customer/FloorPlanViewer";
import { FloorPlanMarkupList } from "@/components/customer/FloorPlanMarkupList";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateMarkupRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateMarkupRequestDialog({ open, onOpenChange }: CreateMarkupRequestDialogProps) {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState<string>("");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [mode, setMode] = useState<MarkupType>("pin");
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState<Set<string>>(new Set());

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      return { ...user, tenant_id: profile?.tenant_id };
    },
  });

  // Fetch customers
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers-for-request"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch locations for selected customer
  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["customer-locations-for-request", selectedCustomerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_locations")
        .select("id, name")
        .eq("customer_id", selectedCustomerId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomerId,
  });

  // Fetch floor plans for selected location
  const { data: floorPlans, isLoading: floorPlansLoading } = useQuery({
    queryKey: ["floor-plans-for-request", selectedLocationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("floor_plans")
        .select("*")
        .eq("customer_location_id", selectedLocationId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLocationId,
  });

  // Get Requests pipeline
  const { data: requestsPipeline } = useQuery({
    queryKey: ["requests-pipeline", currentUser?.tenant_id],
    queryFn: async () => {
      if (!currentUser?.tenant_id) return null;
      const { data, error } = await supabase
        .from("helpdesk_pipelines")
        .select("id")
        .eq("tenant_id", currentUser.tenant_id)
        .eq("name", "Requests")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentUser?.tenant_id,
  });

  // Reset selections when customer changes
  useEffect(() => {
    setSelectedLocationId("");
    setSelectedFloorPlanId("");
    setMarkups([]);
  }, [selectedCustomerId]);

  // Reset floor plan when location changes
  useEffect(() => {
    setSelectedFloorPlanId("");
    setMarkups([]);
  }, [selectedLocationId]);

  // Reset markups when floor plan changes
  useEffect(() => {
    setMarkups([]);
  }, [selectedFloorPlanId]);

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (uploadingPhotos.size > 0) {
        throw new Error("Please wait for photo uploads to complete");
      }

      const incompleteMarkups = markups.filter(m => !m.notes?.trim());
      if (incompleteMarkups.length > 0) {
        throw new Error("Please add a description to all markups");
      }

      if (!currentUser?.tenant_id) {
        throw new Error("Missing tenant information");
      }

      if (!requestsPipeline?.id) {
        throw new Error("Requests pipeline not found");
      }

      if (!selectedCustomerId || !selectedLocationId || !selectedFloorPlanId) {
        throw new Error("Please select customer, location, and floor plan");
      }

      // Create helpdesk ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("helpdesk_tickets")
        .insert([{
          subject: requestTitle,
          customer_id: selectedCustomerId,
          location_id: selectedLocationId,
          tenant_id: currentUser.tenant_id,
          pipeline_id: requestsPipeline.id,
          status: "new",
          priority: "medium",
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create initial message with description if provided
      if (requestDescription) {
        const { error: messageError } = await supabase
          .from("helpdesk_messages")
          .insert([{
            ticket_id: ticket.id,
            tenant_id: currentUser.tenant_id,
            body: requestDescription,
            message_type: "note",
            is_internal: false,
            is_from_customer: false,
          }]);

        if (messageError) {
          console.error("Error creating message:", messageError);
        }
      }

      // Create markup records
      const markupInserts = markups.map((markup) => {
        const photoUrl = typeof markup.photo === 'string' ? markup.photo : undefined;

        if (markup.type === "pin") {
          return {
            ticket_id: ticket.id,
            floor_plan_id: selectedFloorPlanId,
            tenant_id: currentUser.tenant_id,
            pin_x: markup.x,
            pin_y: markup.y,
            markup_data: {
              type: "pin",
              notes: markup.notes,
              photo_url: photoUrl,
            },
          };
        } else {
          const centerX = markup.bounds.x + markup.bounds.width / 2;
          const centerY = markup.bounds.y + markup.bounds.height / 2;
          return {
            ticket_id: ticket.id,
            floor_plan_id: selectedFloorPlanId,
            tenant_id: currentUser.tenant_id,
            pin_x: centerX,
            pin_y: centerY,
            markup_data: {
              type: "zone",
              bounds: markup.bounds,
              notes: markup.notes,
              photo_url: photoUrl,
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
      toast.success("Markup request created successfully!");
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create request");
    },
  });

  const handleClose = () => {
    setSelectedCustomerId("");
    setSelectedLocationId("");
    setSelectedFloorPlanId("");
    setRequestTitle("");
    setRequestDescription("");
    setMarkups([]);
    setMode("pin");
    setSelectedMarkupId(null);
    setUploadingPhotos(new Set());
    onOpenChange(false);
  };

  const updateMarkupNote = (id: string, notes: string) => {
    setMarkups((prev) => prev.map((m) => (m.id === id ? { ...m, notes } : m)));
  };

  const updateMarkupPhoto = (id: string, photo: File | string | null) => {
    setMarkups((prev) => prev.map((m) => (m.id === id ? { ...m, photo: photo || undefined } : m)));
    
    if (typeof photo === 'string' || photo === null) {
      setUploadingPhotos(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const deleteMarkup = (id: string) => {
    setMarkups((prev) => prev.filter((m) => m.id !== id));
    setSelectedMarkupId(null);
  };

  const selectedFloorPlan = floorPlans?.find((p) => p.id === selectedFloorPlanId);
  const floorPlanUrl = selectedFloorPlan?.file_url;
  const floorPlanImageUrl = selectedFloorPlan?.image_url;

  const canCreateRequest = 
    selectedCustomerId &&
    selectedLocationId &&
    selectedFloorPlanId &&
    requestTitle.trim() &&
    markups.length > 0 &&
    markups.every(m => m.notes?.trim()) &&
    uploadingPhotos.size === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Create Markup Request</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden px-6">
          {!selectedFloorPlanId ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger id="customer">
                    <SelectValue placeholder={customersLoading ? "Loading customers..." : "Select customer"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCustomerId && (
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Select 
                    value={selectedLocationId} 
                    onValueChange={setSelectedLocationId}
                    disabled={!selectedCustomerId}
                  >
                    <SelectTrigger id="location">
                      <SelectValue placeholder={locationsLoading ? "Loading locations..." : locations?.length === 0 ? "No locations found" : "Select location"} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedLocationId && (
                <div className="space-y-2">
                  <Label htmlFor="floorPlan">Floor Plan *</Label>
                  <Select 
                    value={selectedFloorPlanId} 
                    onValueChange={setSelectedFloorPlanId}
                    disabled={!selectedLocationId}
                  >
                    <SelectTrigger id="floorPlan">
                      <SelectValue placeholder={floorPlansLoading ? "Loading floor plans..." : floorPlans?.length === 0 ? "No floor plans found" : "Select floor plan"} />
                    </SelectTrigger>
                    <SelectContent>
                      {floorPlans?.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full py-4">
              <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border overflow-hidden">
                <ResizablePanel defaultSize={70} minSize={50}>
                  <div className="h-full p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold truncate">
                        {selectedFloorPlan?.name}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedFloorPlanId("");
                          setMarkups([]);
                        }}
                      >
                        Change Floor Plan
                      </Button>
                    </div>
                    <div className="flex-1 min-h-0">
                      <FloorPlanViewer
                        pdfUrl={floorPlanUrl || ""}
                        imageUrl={floorPlanImageUrl}
                        markups={markups}
                        onMarkupsChange={setMarkups}
                        mode={mode}
                        onModeChange={setMode}
                      />
                    </div>
                  </div>
                </ResizablePanel>
                
                <ResizableHandle withHandle />
                
                <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                  <div className="h-full p-4 overflow-auto space-y-4">
                    {/* Request Details */}
                    <div className="space-y-3 pb-4 border-b">
                      <div className="space-y-2">
                        <Label htmlFor="title">Request Title *</Label>
                        <Input
                          id="title"
                          value={requestTitle}
                          onChange={(e) => setRequestTitle(e.target.value)}
                          placeholder="Brief description of the issue"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={requestDescription}
                          onChange={(e) => setRequestDescription(e.target.value)}
                          placeholder="Detailed description of what needs to be done"
                          rows={2}
                        />
                      </div>
                    </div>
                    
                    {/* Markup List */}
                    <FloorPlanMarkupList
                      markups={markups}
                      onMarkupUpdate={updateMarkupNote}
                      onMarkupPhotoUpdate={updateMarkupPhoto}
                      onMarkupDelete={deleteMarkup}
                      selectedMarkupId={selectedMarkupId}
                      onMarkupSelect={setSelectedMarkupId}
                      uploadingPhotos={uploadingPhotos}
                    />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => createRequestMutation.mutate()}
            disabled={!canCreateRequest || createRequestMutation.isPending}
          >
            {createRequestMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Create Request ${markups.length > 0 ? `(${markups.length})` : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
