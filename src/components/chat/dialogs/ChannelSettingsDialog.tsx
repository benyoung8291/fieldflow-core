import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, UserMinus, UserPlus } from "lucide-react";
import { ChatChannel, ChatMember } from "@/types/chat";
import { useChannelMembers } from "@/hooks/chat/useChatChannels";
import { useLeaveChannel, useAddMember, useRemoveMember, useUpdateChannelDetails } from "@/hooks/chat";
import { useWorkersCache } from "@/hooks/useWorkersCache";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChannelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChatChannel;
}

interface MemberWithProfile extends ChatMember {
  profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function ChannelSettingsDialog({ open, onOpenChange, channel }: ChannelSettingsDialogProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/worker") ? "/worker/chat" : "/chat";
  const { data: members = [] } = useChannelMembers(channel.id);
  const { data: workers = [] } = useWorkersCache();
  const leaveChannel = useLeaveChannel();
  const addMember = useAddMember();
  const removeMember = useRemoveMember();
  const updateChannel = useUpdateChannelDetails();

  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [name, setName] = useState(channel.name || "");
  const [description, setDescription] = useState(channel.description || "");
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  useEffect(() => {
    setName(channel.name || "");
    setDescription(channel.description || "");
  }, [channel]);

  const currentUserMember = useMemo(
    () => members.find((m: MemberWithProfile) => m.user_id === currentUserId),
    [members, currentUserId]
  );

  const isAdminOrOwner = currentUserMember?.role === "admin" || currentUserMember?.role === "owner";
  const isDM = channel.type === "dm";

  // Get members not in channel for add member
  const memberIds = useMemo(() => new Set(members.map((m: MemberWithProfile) => m.user_id)), [members]);
  const availableWorkers = useMemo(() => {
    const available = workers.filter((w) => !memberIds.has(w.id));
    if (!memberSearchQuery.trim()) return available;
    const query = memberSearchQuery.toLowerCase();
    return available.filter(
      (w) =>
        w.first_name?.toLowerCase().includes(query) ||
        w.last_name?.toLowerCase().includes(query) ||
        w.full_name?.toLowerCase().includes(query)
    );
  }, [workers, memberIds, memberSearchQuery]);

  const handleSaveDetails = async () => {
    if (!name.trim()) {
      toast.error("Channel name is required");
      return;
    }

    try {
      await updateChannel.mutateAsync({
        channelId: channel.id,
        name: name.trim(),
        description: description.trim() || null,
      });
      toast.success("Channel updated");
    } catch (error) {
      toast.error("Failed to update channel");
    }
  };

  const handleLeaveChannel = async () => {
    try {
      await leaveChannel.mutateAsync(channel.id);
      toast.success("You left the channel");
      onOpenChange(false);
      navigate(basePath);
    } catch (error) {
      toast.error("Failed to leave channel");
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      await addMember.mutateAsync({ channelId: channel.id, userId });
      toast.success("Member added");
      setShowAddMember(false);
      setMemberSearchQuery("");
    } catch (error) {
      toast.error("Failed to add member");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (userId === currentUserId) {
      toast.error("Use 'Leave Channel' to remove yourself");
      return;
    }

    try {
      await removeMember.mutateAsync({ channelId: channel.id, userId });
      toast.success("Member removed");
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "?";
  };

  const getMemberName = (member: MemberWithProfile) => {
    if (member.profile) {
      return `${member.profile.first_name || ""} ${member.profile.last_name || ""}`.trim() || "Unknown";
    }
    return "Unknown";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isDM ? "Conversation Settings" : `#${channel.name || "Channel"} Settings`}
          </DialogTitle>
          <DialogDescription>
            {isDM ? "Manage this conversation" : "Manage channel settings and members"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {!isDM && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="channel-name">Channel Name</Label>
                  <Input
                    id="channel-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isAdminOrOwner}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channel-description">Description</Label>
                  <Textarea
                    id="channel-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!isAdminOrOwner}
                    rows={3}
                  />
                </div>

                {isAdminOrOwner && (
                  <Button
                    onClick={handleSaveDetails}
                    disabled={updateChannel.isPending}
                    className="w-full"
                  >
                    {updateChannel.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                )}

                <Separator />
              </>
            )}

            <div className="space-y-2">
              <Label className="text-destructive">Danger Zone</Label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    {isDM ? "Leave Conversation" : "Leave Channel"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isDM ? "Leave this conversation?" : "Leave this channel?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {isDM
                        ? "You will no longer receive messages from this conversation."
                        : "You will need to be re-invited to rejoin this channel."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveChannel}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Leave
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-4 mt-4">
            {/* Add Member Button - Hide for DMs */}
            {!isDM && isAdminOrOwner && !showAddMember && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAddMember(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            )}

            {/* Add Member Search */}
            {showAddMember && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <Label>Add a member</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddMember(false);
                      setMemberSearchQuery("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search people..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <ScrollArea className="h-[150px]">
                  {availableWorkers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No available members to add
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {availableWorkers.map((worker) => (
                        <button
                          key={worker.id}
                          onClick={() => handleAddMember(worker.id)}
                          disabled={addMember.isPending}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(worker.first_name, worker.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{worker.full_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Members List */}
            <ScrollArea className="h-[250px]">
              <div className="space-y-1">
                {(members as MemberWithProfile[]).map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.profile?.first_name, member.profile?.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{getMemberName(member)}</span>
                        {member.role === "owner" && (
                          <Badge variant="secondary" className="text-xs">Owner</Badge>
                        )}
                        {member.role === "admin" && (
                          <Badge variant="outline" className="text-xs">Admin</Badge>
                        )}
                        {member.user_id === currentUserId && (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                    </div>

                    {/* Remove button - only for admins, not for DMs, not for self */}
                    {!isDM && isAdminOrOwner && member.user_id !== currentUserId && member.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveMember(member.user_id)}
                        disabled={removeMember.isPending}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
