import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { useWorkersCache } from "@/hooks/useWorkersCache";
import { useChatChannels } from "@/hooks/chat/useChatChannels";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function NewDMDialog({ open, onOpenChange, children }: NewDMDialogProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/worker") ? "/worker/chat" : "/chat";
  const { data: workers = [], isLoading: workersLoading } = useWorkersCache();
  const { data: channels = [] } = useChatChannels();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Get current user ID for filtering
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setCurrentUserId(data.session.user.id);
      }
    });
  }, []);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

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

  const findExistingDM = async (selectedUserId: string, userId: string): Promise<string | null> => {
    // Check each DM channel for membership
    for (const channel of dmChannels) {
      const { data: members } = await supabase
        .from("chat_channel_members")
        .select("user_id")
        .eq("channel_id", channel.id);

      if (members && members.length === 2) {
        const memberIds = members.map((m) => m.user_id);
        if (memberIds.includes(userId) && memberIds.includes(selectedUserId)) {
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
      // Get session synchronously right before insert to ensure auth.uid() matches
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        toast.error("Please sign in to start a conversation");
        setIsCreating(false);
        return;
      }
      const userId = session.user.id;

      // Check for existing DM
      const existingDMId = await findExistingDM(selectedUser.id, userId);

      if (existingDMId) {
        onOpenChange(false);
        navigate(`${basePath}/${existingDMId}`);
        return;
      }

      // Get user's tenant_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
        throw new Error("Could not fetch your profile");
      }

      if (!profile?.tenant_id) {
        toast.error("Your profile is not properly configured. Please contact support.");
        console.error("User profile missing tenant_id:", userId);
        return;
      }

      // Create channel
      const { data: channel, error: channelError } = await supabase
        .from("chat_channels")
        .insert({
          name: null, // DMs don't have names
          type: "dm",
          created_by: userId,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (channelError) {
        console.error("Channel creation error:", channelError);
        throw channelError;
      }

      // Add both users as members
      const { error: membersError } = await supabase
        .from("chat_channel_members")
        .insert([
          {
            channel_id: channel.id,
            user_id: userId,
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

      if (membersError) {
        console.error("Member creation error:", membersError);
        throw membersError;
      }

      toast.success(`Started conversation with ${selectedUser.full_name}`);
      onOpenChange(false);
      navigate(`${basePath}/${channel.id}`);
    } catch (error) {
      console.error("Error creating DM:", error);
      toast.error("Failed to start conversation");
    } finally {
      setIsCreating(false);
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[320px] p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b">
          <DialogTitle className="text-base">New message</DialogTitle>
        </DialogHeader>
        
        <div className="p-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="max-h-[300px]">
          {workersLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">
                {searchQuery ? "No matching users" : "No team members"}
              </span>
            </div>
          ) : (
            <div className="p-2">
              {filteredWorkers.map((worker) => (
                <button
                  key={worker.id}
                  onClick={() => handleSelectUser(worker)}
                  disabled={isCreating}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "active:bg-accent/80",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="text-sm">
                      {getInitials(worker.first_name, worker.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium">{worker.full_name}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
