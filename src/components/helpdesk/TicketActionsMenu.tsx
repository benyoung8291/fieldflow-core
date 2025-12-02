import { useState, useMemo } from "react";
import { MoreVertical, Archive, Tag, UserPlus, CheckCircle2, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TicketActionsMenuProps {
  ticket: any;
}

export function TicketActionsMenu({ ticket }: TicketActionsMenuProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTag, setNewTag] = useState("");

  const { data: users } = useQuery({
    queryKey: ["users-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .order("first_name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments-for-assignment", ticket.customer_id, ticket.location_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          title,
          start_time,
          appointment_number,
          service_order:service_orders(customer_id, customer_location_id)
        `)
        .in("status", ["published", "checked_in"])
        .order("start_time", { ascending: true })
        .limit(50);
      
      if (error) throw error;
      
      // Filter to matching customer if applicable
      if (ticket.customer_id && data) {
        return data.filter((apt: any) => 
          apt.service_order?.customer_id === ticket.customer_id
        );
      }
      return data || [];
    },
    enabled: true,
  });

  // Separate and sort appointments by location relevance
  const { locationAppointments, otherAppointments } = useMemo(() => {
    if (!appointments) return { locationAppointments: [], otherAppointments: [] };
    
    const locationMatched: any[] = [];
    const others: any[] = [];
    
    appointments.forEach((apt: any) => {
      if (ticket.location_id && apt.service_order?.customer_location_id === ticket.location_id) {
        locationMatched.push(apt);
      } else {
        others.push(apt);
      }
    });
    
    return {
      locationAppointments: locationMatched,
      otherAppointments: others
    };
  }, [appointments, ticket.location_id]);

  const handleArchive = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ 
        is_archived: !ticket.is_archived,
        archived_at: !ticket.is_archived ? new Date().toISOString() : null,
        archived_by: !ticket.is_archived ? user?.id : null,
      })
      .eq("id", ticket.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to archive ticket",
        variant: "destructive",
      });
      return;
    }

    // Also archive/unarchive in Microsoft mailbox
    if (ticket.email_account_id && ticket.microsoft_message_id) {
      await supabase.functions.invoke("microsoft-archive-email", {
        body: {
          ticketId: ticket.id,
          shouldArchive: !ticket.is_archived,
        },
      });
    }

    toast({
      title: ticket.is_archived ? "Ticket unarchived" : "Ticket archived",
    });

    queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticket.id] });
  };

  const handleAssignUser = async (userId: string) => {
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ assigned_to: userId })
      .eq("id", ticket.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to assign user",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "User assigned",
    });

    queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticket.id] });
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;

    const currentTags = ticket.tags || [];
    if (currentTags.includes(newTag.trim())) {
      toast({
        title: "Tag already exists",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ tags: [...currentTags, newTag.trim()] })
      .eq("id", ticket.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add tag",
        variant: "destructive",
      });
      return;
    }

    setNewTag("");
    toast({
      title: "Tag added",
    });

    queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticket.id] });
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const currentTags = ticket.tags || [];
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ tags: currentTags.filter((t: string) => t !== tagToRemove) })
      .eq("id", ticket.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove tag",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Tag removed",
    });

    queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticket.id] });
  };

  const handleUpdateStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ status: newStatus })
      .eq("id", ticket.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Status updated",
    });

    queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticket.id] });
  };

  const handleAssignToAppointment = async (appointmentId: string | null) => {
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ appointment_id: appointmentId })
      .eq("id", ticket.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to assign to appointment",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: appointmentId ? "Assigned to appointment" : "Unassigned from appointment",
    });

    queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["helpdesk-ticket", ticket.id] });
    queryClient.invalidateQueries({ queryKey: ["appointment-requests"] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Status */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Change Status
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleUpdateStatus("open")}>
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUpdateStatus("in_progress")}>
              In Progress
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUpdateStatus("waiting_response")}>
              Waiting Response
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUpdateStatus("resolved")}>
              Resolved
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUpdateStatus("closed")}>
              Closed
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Assign User */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <UserPlus className="h-4 w-4 mr-2" />
            Assign to
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => handleAssignUser(null as any)}>
              Unassign
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {users?.map((user) => (
              <DropdownMenuItem key={user.id} onClick={() => handleAssignUser(user.id)}>
                {user.first_name} {user.last_name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Assign to Appointment */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Calendar className="h-4 w-4 mr-2" />
            Assign to Appointment
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
            <DropdownMenuItem onClick={() => handleAssignToAppointment(null)}>
              Unassign
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            
            {/* Location-matched appointments section */}
            {locationAppointments.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                  At this location
                </div>
                {locationAppointments.map((apt: any) => (
                  <DropdownMenuItem 
                    key={apt.id} 
                    onClick={() => handleAssignToAppointment(apt.id)}
                    className="flex flex-col items-start"
                  >
                    <span className="font-medium">{apt.appointment_number || apt.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(apt.start_time), 'MMM d, h:mm a')}
                    </span>
                  </DropdownMenuItem>
                ))}
                {otherAppointments.length > 0 && <DropdownMenuSeparator />}
              </>
            )}
            
            {/* Other appointments section */}
            {otherAppointments.length > 0 && (
              <>
                {locationAppointments.length > 0 && (
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                    Other appointments
                  </div>
                )}
                {otherAppointments.map((apt: any) => (
                  <DropdownMenuItem 
                    key={apt.id} 
                    onClick={() => handleAssignToAppointment(apt.id)}
                    className="flex flex-col items-start"
                  >
                    <span className="font-medium">{apt.appointment_number || apt.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(apt.start_time), 'MMM d, h:mm a')}
                    </span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            
            {/* No appointments message */}
            {locationAppointments.length === 0 && otherAppointments.length === 0 && (
              <div className="px-2 py-1 text-sm text-muted-foreground">
                No appointments found
              </div>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Tags */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Tag className="h-4 w-4 mr-2" />
            Tags
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            <div className="p-2 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddTag();
                    }
                  }}
                  className="h-7 text-xs"
                />
                <Button size="sm" onClick={handleAddTag} className="h-7 text-xs">
                  Add
                </Button>
              </div>
              {ticket.tags && ticket.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ticket.tags.map((tag: string) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Archive */}
        <DropdownMenuItem onClick={handleArchive}>
          <Archive className="h-4 w-4 mr-2" />
          {ticket.is_archived ? "Unarchive" : "Archive"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
