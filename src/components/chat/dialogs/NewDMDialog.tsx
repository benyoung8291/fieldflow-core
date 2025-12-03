import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useWorkersCache } from "@/hooks/useWorkersCache";
import { useChatChannels, useChannelMembers } from "@/hooks/chat/useChatChannels";
import { useCreateChannel, useJoinChannel } from "@/hooks/chat";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewDMDialog({ open, onOpenChange }: NewDMDialogProps) {
  const navigate = useNavigate();
  const { data: workers = [], isLoading: workersLoading } = useWorkersCache();
  const { data: channels = [] } = useChatChannels();
  const createChannel = useCreateChannel();
  const joinChannel = useJoinChannel();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  // Filter out current user from the list
  const filteredWorkers = useMemo(() => {
    const availableWorkers = workers.filter((w) => w.id !== currentUserId);
    
    if (!searchQuery.trim()) return availableWorkers;
    
    const query = searchQuery.toLowerCase();
    return availableWorkers.filter(
      (w) =>
        w.first_name?.toLowerCase().includes(query) ||
        w.last_name?.toLowerCase().includes(query) ||
        w.full_name?.toLowerCase().includes(query)
    );
  }, [workers, searchQuery, currentUserId]);

  // Get existing DM channels
  const dmChannels = useMemo(() => channels.filter((c) => c.type === "dm"), [channels]);

  const findExistingDM = async (selectedUserId: string): Promise<string | null> => {
    // Check each DM channel for membership
    for (const channel of dmChannels) {
      const { data: members } = await supabase
        .from("chat_channel_members")
        .select("user_id")
        .eq("channel_id", channel.id);

      if (members && members.length === 2) {
        const memberIds = members.map((m) => m.user_id);
        if (memberIds.includes(currentUserId) && memberIds.includes(selectedUserId)) {
          return channel.id;
        }
      }
    }
    return null;
  };

  const handleSelectUser = async (selectedUser: typeof workers[0]) => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      // Check for existing DM
      const existingDMId = await findExistingDM(selectedUser.id);

      if (existingDMId) {
        onOpenChange(false);
        navigate(`/chat/${existingDMId}`);
        return;
      }

      // Create new DM channel
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", currentUserId)
        .single();

      if (!profile?.tenant_id) {
        throw new Error("No tenant found");
      }

      // Create channel
      const { data: channel, error: channelError } = await supabase
        .from("chat_channels")
        .insert({
          name: null, // DMs don't have names
          type: "dm",
          created_by: currentUserId,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (channelError) throw channelError;

      // Add both users as members
      const { error: membersError } = await supabase
        .from("chat_channel_members")
        .insert([
          {
            channel_id: channel.id,
            user_id: currentUserId,
            tenant_id: profile.tenant_id,
            role: "owner",
          },
          {
            channel_id: channel.id,
            user_id: selectedUser.id,
            tenant_id: profile.tenant_id,
            role: "member",
          },
        ]);

      if (membersError) throw membersError;

      toast.success(`Started conversation with ${selectedUser.full_name}`);
      onOpenChange(false);
      navigate(`/chat/${channel.id}`);
    } catch (error) {
      console.error("Error creating DM:", error);
      toast.error("Failed to start conversation");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSearchQuery("");
    }
    onOpenChange(open);
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
          <DialogDescription>
            Start a conversation with a team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="h-[300px]">
            {workersLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-sm text-muted-foreground">
                  {searchQuery ? "No matching users found" : "No team members available"}
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredWorkers.map((worker) => (
                  <button
                    key={worker.id}
                    onClick={() => handleSelectUser(worker)}
                    disabled={isCreating}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(worker.first_name, worker.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{worker.full_name}</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
