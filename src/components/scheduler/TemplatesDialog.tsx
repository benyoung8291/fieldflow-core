import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, FileText, MoreVertical, Trash2, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseAppointmentTemplate: (template: any) => void;
  onUseServiceOrderTemplate: (template: any) => void;
}

export default function TemplatesDialog({
  open,
  onOpenChange,
  onUseAppointmentTemplate,
  onUseServiceOrderTemplate,
}: TemplatesDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("appointments");

  const { data: appointmentTemplates = [] } = useQuery({
    queryKey: ["appointment-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_templates")
        .select("*, creator:profiles!created_by(first_name, last_name)")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: serviceOrderTemplates = [] } = useQuery({
    queryKey: ["service-order-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_templates")
        .select("*, creator:profiles!created_by(first_name, last_name)")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const deleteAppointmentTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointment_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-templates"] });
      toast.success("Template deleted");
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  const deleteServiceOrderTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_order_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-order-templates"] });
      toast.success("Template deleted");
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Templates</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="appointments">
              Appointment Templates ({appointmentTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="service-orders">
              Service Order Templates ({serviceOrderTemplates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {appointmentTemplates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No appointment templates yet</p>
                    <p className="text-sm mt-2">
                      Save an appointment as a template to see it here
                    </p>
                  </div>
                ) : (
                  appointmentTemplates.map((template) => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            {template.description && (
                              <CardDescription className="text-sm mt-1">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  onUseAppointmentTemplate(template);
                                  onOpenChange(false);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Use Template
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => deleteAppointmentTemplate.mutate(template.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {template.duration_hours}h
                          </Badge>
                          {template.creator && (
                            <Badge variant="outline">
                              {template.creator.first_name} {template.creator.last_name}
                            </Badge>
                          )}
                          {template.is_recurring && (
                            <Badge variant="secondary">Recurring</Badge>
                          )}
                          {template.location_address && (
                            <span className="text-xs truncate max-w-[200px]">
                              📍 {template.location_address}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="service-orders" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {serviceOrderTemplates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No service order templates yet</p>
                    <p className="text-sm mt-2">
                      Save a service order as a template to see it here
                    </p>
                  </div>
                ) : (
                  serviceOrderTemplates.map((template) => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            {template.description && (
                              <CardDescription className="text-sm mt-1">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  onUseServiceOrderTemplate(template);
                                  onOpenChange(false);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Use Template
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => deleteServiceOrderTemplate.mutate(template.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline">{template.billing_type || "N/A"}</Badge>
                          {template.hourly_rate && (
                            <Badge variant="outline">${template.hourly_rate}/hr</Badge>
                          )}
                          {template.fixed_amount && (
                            <Badge variant="outline">${template.fixed_amount}</Badge>
                          )}
                          {template.estimated_hours && (
                            <Badge variant="outline">~{template.estimated_hours}h</Badge>
                          )}
                          {template.priority && (
                            <Badge variant="secondary">{template.priority}</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
