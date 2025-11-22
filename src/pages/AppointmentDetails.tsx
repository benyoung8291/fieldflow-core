import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Download, Trash2, Calendar, Clock, MapPin, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import TimeLogsTable from "@/components/service-orders/TimeLogsTable";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import { usePermissions } from "@/hooks/usePermissions";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useSwipeToClose } from "@/hooks/useSwipeGesture";
import { cn } from "@/lib/utils";
import AddressAutocomplete from "@/components/customers/AddressAutocomplete";
import FieldReportsList from "@/components/field-reports/FieldReportsList";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-info/10 text-info",
  checked_in: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const fileCategories = [
  { value: "general", label: "General" },
  { value: "floor_plan", label: "Floor Plan" },
  { value: "photo", label: "Photo" },
  { value: "notes", label: "Notes" },
  { value: "measurement", label: "Measurement" },
  { value: "marked_up_plan", label: "Marked Up Plan" },
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
];

export default function AppointmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, userRoles } = usePermissions();
  const { isMobile } = useViewMode();
  const isSupervisorOrAdmin = isAdmin || userRoles?.some((r) => r.role === "supervisor");
  const [isDragging, setIsDragging] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    location_address: "",
  });

  // Fetch appointment details
  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointment", id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          service_orders (
            id,
            work_order_number,
            purchase_order_number,
            customer_id,
            customers (
              name
            )
          ),
          appointment_workers (
            id,
            worker_id,
            profiles (
              id,
              first_name,
              last_name
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch related appointments on same service order
  const { data: relatedAppointments = [] } = useQuery({
    queryKey: ["related-appointments", appointment?.service_order_id],
    enabled: !!appointment?.service_order_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          title,
          start_time,
          end_time,
          status
        `)
        .eq("service_order_id", appointment.service_order_id)
        .neq("id", id)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch appointment attachments
  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["appointment-attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_attachments")
        .select(`
          *,
          profiles (
            first_name,
            last_name
          )
        `)
        .eq("appointment_id", id)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from("appointments")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment", id] });
      toast.success("Appointment updated successfully");
      setEditMode(false);
    },
    onError: () => {
      toast.error("Failed to update appointment");
    },
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.tenant_id}/${id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("appointment-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("appointment-files")
        .getPublicUrl(fileName);

      // Create attachment record
      const { error: dbError } = await supabase
        .from("appointment_attachments")
        .insert({
          tenant_id: profile.tenant_id,
          appointment_id: id,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          category,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      refetchAttachments();
      toast.success("File uploaded successfully");
    },
    onError: () => {
      toast.error("Failed to upload file");
    },
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase
        .from("appointment_attachments")
        .delete()
        .eq("id", attachmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchAttachments();
      toast.success("File deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete file");
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent, category: string = "general") => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      uploadFileMutation.mutate({ file, category });
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, category: string = "general") => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      uploadFileMutation.mutate({ file, category });
    });
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formDataFromEvent = new FormData(e.currentTarget);
    updateAppointmentMutation.mutate({
      title: formDataFromEvent.get("title"),
      description: formDataFromEvent.get("description"),
      notes: formDataFromEvent.get("notes"),
      status: formDataFromEvent.get("status"),
      location_address: formData.location_address || appointment?.location_address,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading appointment...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!appointment) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Appointment not found</div>
        </div>
      </DashboardLayout>
    );
  }

  // Mobile Layout
  if (isMobile) {
    const { elementRef, swipeProgress } = useSwipeToClose(() => navigate("/appointments"), true);
    
    return (
      <DashboardLayout>
        <div ref={elementRef} className="min-h-screen bg-background pb-20">
          {/* Swipe indicator */}
          {swipeProgress > 0 && (
            <div 
              className="fixed left-0 top-0 bottom-0 w-1 bg-primary/30 transition-opacity"
              style={{ opacity: swipeProgress }}
            />
          )}
          
          {/* Mobile Header */}
          <div className="sticky top-0 z-20 bg-background border-b p-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/appointments")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold truncate">{appointment.title}</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {format(new Date(appointment.start_time), "MMM d, yyyy h:mm a")}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn("flex-shrink-0 text-xs", statusColors[appointment.status as keyof typeof statusColors])}
              >
                {appointment.status}
              </Badge>
            </div>
          </div>

          {/* Mobile Content */}
          <div className="p-3">
            <Accordion type="multiple" defaultValue={["details"]} className="space-y-2">
              {/* Details Section */}
              <AccordionItem value="details" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <span className="font-medium">Details</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Start</Label>
                      <p className="text-sm font-medium mt-1">
                        {format(new Date(appointment.start_time), "h:mm a")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">End</Label>
                      <p className="text-sm font-medium mt-1">
                        {format(new Date(appointment.end_time), "h:mm a")}
                      </p>
                    </div>
                  </div>
                  {appointment.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <p className="text-sm mt-1">{appointment.description}</p>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Workers Section */}
              {appointment.appointment_workers && appointment.appointment_workers.length > 0 && (
                <AccordionItem value="workers" className="border rounded-lg bg-card">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">Workers ({appointment.appointment_workers.length})</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-2">
                    {appointment.appointment_workers.map((aw: any) => (
                      <div key={aw.id} className="flex items-center gap-2 p-2 border rounded-lg">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {aw.profiles?.first_name?.[0]}{aw.profiles?.last_name?.[0]}
                          </span>
                        </div>
                        <span className="text-sm">
                          {aw.profiles?.first_name} {aw.profiles?.last_name}
                        </span>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Files & Time Logs */}
              <AccordionItem value="files" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Files ({attachments.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {attachments.map((file: any) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <p className="text-sm truncate">{file.file_name}</p>
                        </div>
                        <Button variant="ghost" size="icon" asChild>
                          <a href={file.file_url} download>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="time-logs" className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Time Logs</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <TimeLogsTable appointmentId={id!} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Desktop Layout
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/appointments")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{appointment.title}</h1>
              <p className="text-muted-foreground">Appointment Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={statusColors[appointment.status as keyof typeof statusColors]}
            >
              {appointment.status}
            </Badge>
            {!editMode ? (
              <Button onClick={() => setEditMode(true)}>Edit Details</Button>
            ) : (
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Appointment Information</CardTitle>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input id="title" name="title" defaultValue={appointment.title} required />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" name="description" defaultValue={appointment.description || ""} />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select name="status" defaultValue={appointment.status}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="checked_in">Checked In</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="location_address">Location</Label>
                      <AddressAutocomplete
                        value={formData.location_address || appointment.location_address || ""}
                        onChange={(value) => setFormData({ ...formData, location_address: value })}
                        onPlaceSelect={(place) => setFormData({
                          ...formData,
                          location_address: place.address,
                        })}
                        placeholder="Start typing to search address..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" name="notes" defaultValue={appointment.notes || ""} />
                    </div>
                    <Button type="submit" disabled={updateAppointmentMutation.isPending}>
                      {updateAppointmentMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Date:</span>
                        <span>{format(new Date(appointment.start_time), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Time:</span>
                        <span>{format(new Date(appointment.start_time), "h:mm a")} - {format(new Date(appointment.end_time), "h:mm a")}</span>
                      </div>
                    </div>
                    {appointment.location_address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium">Location:</span>
                          <p className="text-muted-foreground">{appointment.location_address}</p>
                        </div>
                      </div>
                    )}
                    {appointment.description && (
                      <div className="flex items-start gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium">Description:</span>
                          <p className="text-muted-foreground">{appointment.description}</p>
                        </div>
                      </div>
                    )}
                    {appointment.notes && (
                      <div className="pt-4 border-t">
                        <span className="font-medium text-sm">Notes:</span>
                        <p className="text-sm text-muted-foreground mt-1">{appointment.notes}</p>
                      </div>
                    )}
                    {appointment.service_orders && (
                      <div className="pt-4 border-t">
                        <span className="font-medium text-sm">Service Order:</span>
                        <div className="mt-1 text-sm">
                          <p>WO: {appointment.service_orders.work_order_number}</p>
                          {appointment.service_orders.purchase_order_number && (
                            <p>PO: {appointment.service_orders.purchase_order_number}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="files" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="files">Files & Documents</TabsTrigger>
                <TabsTrigger value="time-logs">Time Logs</TabsTrigger>
              </TabsList>

              {/* Files Tab */}
              <TabsContent value="files" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Files & Documents</CardTitle>
                      <label>
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFileSelect(e)}
                        />
                        <Button variant="outline" size="sm" asChild>
                          <span className="cursor-pointer">
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Files
                          </span>
                        </Button>
                      </label>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e)}
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        isDragging ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Drag and drop files here, or click the upload button
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports all file types
                      </p>
                    </div>

                    {/* Files by Category */}
                    <div className="mt-6 space-y-6">
                      {fileCategories.map((category) => {
                        const categoryFiles = attachments.filter(
                          (att: any) => att.category === category.value
                        );

                        if (categoryFiles.length === 0) return null;

                        return (
                          <div key={category.value}>
                            <h3 className="font-medium text-sm mb-3">{category.label}</h3>
                            <div className="space-y-2">
                              {categoryFiles.map((file: any) => (
                                <div
                                  key={file.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">{file.file_name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Uploaded by {file.profiles?.first_name} {file.profiles?.last_name} on{" "}
                                        {format(new Date(file.uploaded_at), "MMM d, yyyy")}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      asChild
                                    >
                                      <a href={file.file_url} download target="_blank" rel="noopener noreferrer">
                                        <Download className="h-4 w-4" />
                                      </a>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteAttachmentMutation.mutate(file.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {attachments.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No files uploaded yet
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Time Logs Tab */}
              <TabsContent value="time-logs">
                <Card>
                  <CardHeader>
                    <CardTitle>Time Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TimeLogsTable
                      appointmentId={id!}
                    />
                    {isSupervisorOrAdmin && (
                      <p className="text-xs text-muted-foreground mt-4">
                        As a supervisor or admin, you can edit time logs for timecard and payroll adjustments.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Assigned Workers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned Workers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appointment.appointment_workers && appointment.appointment_workers.length > 0 ? (
                  <div className="space-y-2">
                    {appointment.appointment_workers.map((aw: any) => (
                      <div key={aw.id} className="flex items-center gap-2 text-sm">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {aw.profiles?.first_name?.[0]}{aw.profiles?.last_name?.[0]}
                          </span>
                        </div>
                        <span>
                          {aw.profiles?.first_name} {aw.profiles?.last_name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No workers assigned</p>
                )}
              </CardContent>
            </Card>

            {/* Related Appointments */}
            {relatedAppointments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Other Appointments on Service Order</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {relatedAppointments.map((apt: any) => (
                      <div
                        key={apt.id}
                        className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/appointments/${apt.id}`)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{apt.title}</span>
                          <Badge
                            variant="outline"
                            className={`${statusColors[apt.status as keyof typeof statusColors]} text-xs`}
                          >
                            {apt.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(apt.start_time), "MMM d, h:mm a")}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Field Reports */}
            <Card>
              <CardHeader>
                <CardTitle>Field Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldReportsList appointmentId={id!} />
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tasks</CardTitle>
                  <CreateTaskButton
                    linkedModule="appointment"
                    linkedRecordId={id!}
                    variant="default"
                    size="sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <LinkedTasksList linkedModule="appointment" linkedRecordId={id!} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}