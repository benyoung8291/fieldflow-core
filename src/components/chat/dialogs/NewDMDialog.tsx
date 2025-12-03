import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useWorkersCache } from "@/hooks/useWorkersCache";
import { useChatChannels } from "@/hooks/chat/useChatChannels";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewDMDialog({ open, onOpenChange }: NewDMDialogProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/worker") ? "/worker/chat" : "/chat";
  const { data: workers = [], isLoading: workersLoading } = useWorkersCache();
  const { data: channels = [] } = useChatChannels();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

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
        navigate(`${basePath}/${existingDMId}`);
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
      navigate(`${basePath}/${channel.id}`);
    } catch (error) {
      console.error("Error creating DM:", error);
      toast.error("Failed to start conversation");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearchQuery("");
    }
    onOpenChange(newOpen);
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  if (!open) return null;

  return (
    <div 
      ref={dropdownRef}
      className="absolute left-0 top-full mt-1 z-50 w-64 rounded-md border border-border bg-popover shadow-lg"
    >
      <div className="flex items-center justify-between p-2 border-b border-border">
        <span className="text-sm font-medium text-foreground">New message</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => handleOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
            autoFocus
          />
        </div>
      </div>

      <ScrollArea className="max-h-[240px]">
        {workersLoading ? (
          <div className="flex items-center justify-center py-4">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <span className="text-sm text-muted-foreground">
              {searchQuery ? "No matching users" : "No team members"}
            </span>
          </div>
        ) : (
          <div className="p-1">
            {filteredWorkers.map((worker) => (
              <button
                key={worker.id}
                onClick={() => handleSelectUser(worker)}
                disabled={isCreating}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(worker.first_name, worker.last_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{worker.full_name}</span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
