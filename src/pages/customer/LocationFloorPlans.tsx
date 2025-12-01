import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { CustomerPortalLayout } from "@/components/layout/CustomerPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FloorPlanViewer, Markup, MarkupType } from "@/components/customer/FloorPlanViewer";
import { MobileFloorPlanViewer } from "@/components/customer/MobileFloorPlanViewer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { FloorPlanMarkupList } from "@/components/customer/FloorPlanMarkupList";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, ArrowLeft, Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

export default function LocationFloorPlans() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [mode, setMode] = useState<MarkupType>("pin");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState("Add to next service");
  const [taskDescription, setTaskDescription] = useState("");
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

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
      console.log("Customer portal: Fetching floor plans for location", locationId);
      const { data, error } = await supabase
        .from("floor_plans")
        .select("*")
        .eq("customer_location_id", locationId!);

      if (error) {
        console.error("Customer portal: Error fetching floor plans", error);
        throw error;
      }
      
      console.log("Customer portal: Floor plans loaded", data?.length || 0);
      
      // Since bucket is public, use file_url directly
      return data || [];
    },
    enabled: !!locationId,
  });

  // Auto-select floor plan from URL params if present
  useEffect(() => {
    const floorPlanId = searchParams.get("floorPlan");
    if (floorPlanId && floorPlans && !isLoading) {
      console.log("Auto-selecting floor plan from URL:", floorPlanId);
      const planExists = floorPlans.find(p => p.id === floorPlanId);
      if (planExists) {
        console.log("Floor plan found, selecting:", planExists);
        setSelectedPlan(floorPlanId);
      } else {
        console.error("Floor plan not found in available plans:", floorPlanId);
        toast.error("The selected floor plan could not be found");
      }
    }
  }, [searchParams, floorPlans, isLoading]);

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
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
      
      console.log("Customer portal: Profile data loaded", data);
      return data;
    },
  });

  // Get Requests pipeline ID
  const { data: requestsPipeline } = useQuery({
    queryKey: ["requests-pipeline", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;
      
      console.log("Fetching Requests pipeline for tenant:", profile.tenant_id);
      
      const { data, error } = await supabase
        .from("helpdesk_pipelines")
        .select("id")
        .eq("tenant_id", profile.tenant_id)
        .eq("name", "Requests")
        .maybeSingle();

      if (error) {
        console.error("Error fetching Requests pipeline:", error);
        throw error;
      }
      
      console.log("Requests pipeline found:", data);
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      // Check if any uploads are still in progress
      if (uploadingPhotos.size > 0) {
        toast.error("Please wait for photo uploads to complete");
        throw new Error('Photos still uploading');
      }

      // Validate that all markups have notes
      const incompleteMarkups = markups.filter(m => !m.notes?.trim());
      if (incompleteMarkups.length > 0) {
        toast.error("Please add a description to all markups before creating a request");
        throw new Error('Missing markup descriptions');
      }

      // Warn if photos are missing (but don't block)
      const markupsWithoutPhotos = markups.filter(m => !m.photo);
      if (markupsWithoutPhotos.length > 0) {
        toast.info("Consider adding photos to your markups for faster resolution");
      }

      console.log("Creating request with:", { 
        customerId: profile?.customer_id, 
        tenantId: profile?.tenant_id, 
        pipelineId: requestsPipeline?.id,
        title: taskTitle,
        markupsCount: markups.length 
      });

      if (!profile?.customer_id || !profile?.tenant_id) {
        throw new Error("Missing customer or tenant information");
      }

      if (!requestsPipeline?.id) {
        throw new Error("Requests pipeline not found. Please contact support.");
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

      if (ticketError) {
        console.error("Error creating ticket:", ticketError);
        throw ticketError;
      }

      // Create initial message with description if provided
      if (taskDescription) {
        const { error: messageError } = await supabase
          .from("helpdesk_messages")
          .insert([{
            ticket_id: ticket.id,
            tenant_id: profile.tenant_id,
            body: taskDescription,
            message_type: "note",
            is_internal: false,
            is_from_customer: true,
          }]);

        if (messageError) {
          console.error("Error creating message:", messageError);
          // Don't throw - ticket was created successfully
        }
      }

      // Create markup records (photos are already uploaded as URLs)
      const markupInserts = markups.map((markup, index) => {
        const photoUrl = typeof markup.photo === 'string' ? markup.photo : undefined;

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
              photo_url: photoUrl,
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
      toast.success("Request created successfully!");
      queryClient.invalidateQueries({ queryKey: ["customer-tickets"] });
      setShowCreateDialog(false);
      setMarkups([]);
      setTaskTitle("Add to next service");
      setTaskDescription("");
      navigate("/customer/requests");
    },
    onError: (error: any) => {
      console.error("Failed to create request:", error);
      const errorMessage = error?.message || "Failed to create request";
      toast.error(errorMessage);
    },
  });

  const [uploadingPhotos, setUploadingPhotos] = useState<Set<string>>(new Set());

  const updateMarkupNote = (id: string, notes: string) => {
    setMarkups((prev) =>
      prev.map((m) => (m.id === id ? { ...m, notes } : m))
    );
  };

  const updateMarkupPhoto = (id: string, photo: File | string | null) => {
    setMarkups((prev) =>
      prev.map((m) => (m.id === id ? { ...m, photo: photo || undefined } : m))
    );
    
    // Remove from uploading set if it's a string URL (upload complete)
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
    toast.success("Markup deleted");
  };

  const selectedFloorPlan = floorPlans?.find((p) => p.id === selectedPlan);
  const floorPlanUrl = selectedFloorPlan?.file_url;
  const floorPlanImageUrl = selectedFloorPlan?.image_url;
  
  console.log("Floor plan viewer state:", {
    selectedPlanId: selectedPlan,
    floorPlansCount: floorPlans?.length || 0,
    selectedFloorPlan: selectedFloorPlan ? {
      id: selectedFloorPlan.id,
      name: selectedFloorPlan.name,
      floor_number: selectedFloorPlan.floor_number,
      file_url: floorPlanUrl,
      image_url: floorPlanImageUrl,
      file_path: selectedFloorPlan.file_path
    } : null
  });

  // Show error if floor plan is selected but has no file URL
  useEffect(() => {
    if (selectedPlan && selectedFloorPlan && !floorPlanUrl && !floorPlanImageUrl) {
      console.error("Selected floor plan has no file_url or image_url:", selectedFloorPlan);
      toast.error("This floor plan has no file attached. Please contact support.");
    }
  }, [selectedPlan, selectedFloorPlan, floorPlanUrl, floorPlanImageUrl]);

  // Fullscreen focus mode for desktop
  if (isFullscreen && selectedPlan) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-background">
          <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Exit Focus Mode
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => { 
                  setSelectedPlan(null); 
                  setMarkups([]); 
                  setIsFullscreen(false); 
                }}
              >
                Back to Plans
              </Button>
              <Button 
                onClick={() => {
                  const incompleteMarkups = markups.filter(m => !m.notes?.trim());
                  if (incompleteMarkups.length > 0) {
                    toast.error("Please add a description to all markups");
                    return;
                  }
                  setTaskTitle("Add to next service");
                  setTaskDescription("");
                  setShowCreateDialog(true);
                }}
                disabled={
                  markups.length === 0 || 
                  uploadingPhotos.size > 0 || 
                  profileLoading ||
                  !profile?.tenant_id || 
                  !profile?.customer_id
                }
              >
                {profileLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : uploadingPhotos.size > 0 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  `Create Request (${markups.length})`
                )}
              </Button>
            </div>
          </div>
          <div className="h-full pt-20 px-4">
            <ResizablePanelGroup direction="horizontal" className="h-full rounded-2xl border overflow-hidden">
              <ResizablePanel defaultSize={75} minSize={50}>
                <div className="h-full p-4 flex flex-col">
                  <h2 className="text-lg font-semibold mb-4 truncate">
                    {selectedFloorPlan?.name}
                  </h2>
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
              
              <ResizablePanel defaultSize={25} minSize={15} maxSize={40} collapsible collapsedSize={4}>
                <div className="h-full p-4 overflow-auto">
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
        </div>

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
                disabled={!taskTitle || createRequestMutation.isPending || !profile?.tenant_id || !profile?.customer_id}
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
      </>
    );
  }

  // Mobile full-screen view (outside layout to hide footer)
  if (isMobile && selectedPlan) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-background">
          <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-background to-transparent pointer-events-none">
            <div className="flex items-center justify-between pointer-events-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPlan(null);
                  setMarkups([]);
                }}
                className="bg-background/95 backdrop-blur shadow-lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  // Check if any uploads are still in progress
                  if (uploadingPhotos.size > 0) {
                    toast.error("Please wait for photo uploads to complete");
                    return;
                  }

                  // Validate markups before opening dialog
                  const incompleteMarkups = markups.filter(m => !m.notes?.trim());
                  if (incompleteMarkups.length > 0) {
                    toast.error("Please add a description to all markups before creating a request");
                    return;
                  }
                  
                  const markupsWithoutPhotos = markups.filter(m => !m.photo);
                  if (markupsWithoutPhotos.length > 0) {
                    toast.info("Consider adding photos to your markups for faster resolution");
                  }
                  
                  setTaskTitle("Add to next service");
                  setTaskDescription("");
                  setShowCreateDialog(true);
                }}
                disabled={
                  markups.length === 0 || 
                  uploadingPhotos.size > 0 || 
                  profileLoading ||
                  !profile?.tenant_id || 
                  !profile?.customer_id
                }
                className="shadow-lg"
              >
                {profileLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : uploadingPhotos.size > 0 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  `Create (${markups.length})`
                )}
              </Button>
            </div>
          </div>
          <MobileFloorPlanViewer
            pdfUrl={floorPlanUrl || ""}
            imageUrl={floorPlanImageUrl}
            markups={markups}
            onMarkupsChange={setMarkups}
            uploadingPhotos={uploadingPhotos}
          />
        </div>

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
                disabled={!taskTitle || createRequestMutation.isPending || !profile?.tenant_id || !profile?.customer_id}
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
      </>
    );
  }

  return (
    <CustomerPortalLayout fullWidth={!!selectedPlan}>
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
          <>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold truncate">
                {selectedFloorPlan?.name}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsFullscreen(true)}
                  title="Focus Mode"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
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
                  onClick={() => {
                    const incompleteMarkups = markups.filter(m => !m.notes?.trim());
                    if (incompleteMarkups.length > 0) {
                      toast.error("Please add a description to all markups");
                      return;
                    }
                    setTaskTitle("Add to next service");
                    setTaskDescription("");
                    setShowCreateDialog(true);
                  }}
                  disabled={
                    markups.length === 0 || 
                    uploadingPhotos.size > 0 || 
                    profileLoading ||
                    !profile?.tenant_id || 
                    !profile?.customer_id
                  }
                >
                  {profileLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : uploadingPhotos.size > 0 ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    `Create Request (${markups.length})`
                  )}
                </Button>
              </div>
            </div>
            
            {profileError && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-2">
                Failed to load profile. Please refresh the page.
              </div>
            )}
            
            <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-8rem)] rounded-2xl border overflow-hidden">
              {/* Main Floor Plan Viewer */}
              <ResizablePanel defaultSize={75} minSize={50}>
                <div className="h-full p-2 flex flex-col">
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
              
              {/* Collapsible Sidebar */}
              <ResizablePanel defaultSize={25} minSize={15} maxSize={40} collapsible collapsedSize={4}>
                <div className="h-full p-4 overflow-auto">
                  <h3 className="font-semibold mb-4">Markups ({markups.length})</h3>
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
          </>
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
