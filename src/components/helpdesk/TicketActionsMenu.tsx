import { useState } from "react";
import { MoreVertical, Archive, Tag, UserPlus, CheckCircle2 } from "lucide-react";
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
