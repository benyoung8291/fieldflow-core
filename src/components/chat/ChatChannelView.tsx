import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Hash, Lock, MessageCircle, Users, Info } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatChannel, useChannelMembers } from "@/hooks/chat/useChatChannels";
import { useChatNotifications } from "@/hooks/chat/useChatNotifications";
import { useChatTyping } from "@/hooks/chat/useChatTyping";
import { useDMChannelName } from "@/hooks/chat/useDMChannelName";
import { useChatPresence } from "@/hooks/chat/useChatPresence";
import { useChannelMessages } from "@/hooks/chat/useChannelMessages";
import { supabase } from "@/integrations/supabase/client";
import { MessageWithProfile } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ChatEmptyState } from "./ChatEmptyState";
import { TypingIndicator } from "./TypingIndicator";
import { ChannelSettingsDialog } from "./dialogs/ChannelSettingsDialog";
import { OnlineIndicator } from "./OnlineIndicator";
import { cn } from "@/lib/utils";

interface ChatChannelViewProps {
  channelId?: string;
  className?: string;
}

export function ChatChannelView({ channelId: propChannelId, className }: ChatChannelViewProps) {
  const { channelId: paramChannelId } = useParams();
  const channelId = propChannelId || paramChannelId;
  const isEmbedded = !!propChannelId;
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { data: channel, isLoading: channelLoading } = useChatChannel(channelId || null);
  const { data: members = [] } = useChannelMembers(channelId || null);
  const { data: messages = [] } = useChannelMessages(channelId || "");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // DM specific hooks
  const isDM = channel?.type === "dm";
  const { data: dmInfo } = useDMChannelName(isDM ? channelId || null : null);
  const { isUserOnline } = useChatPresence();
  
  // Message action states
  const [editingMessage, setEditingMessage] = useState<MessageWithProfile | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageWithProfile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Enable notifications and typing for this channel
  useChatNotifications(channelId);
  const { typingUsers, broadcastTyping } = useChatTyping(channelId);
  
  // Determine back navigation path based on current app context
  const isWorkerApp = location.pathname.startsWith("/worker");
  const backPath = isWorkerApp ? "/worker/chat" : "/chat";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  const handleReply = useCallback((message: MessageWithProfile) => {
    setEditingMessage(null);
    setReplyingTo(message);
  }, []);

  const handleEdit = useCallback((message: MessageWithProfile) => {
    setReplyingTo(null);
    setEditingMessage(message);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  if (channelLoading) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="flex h-14 items-center gap-3 border-b px-4">
          {isMobile && !isEmbedded && <Skeleton className="h-8 w-8" />}
          <div className="flex-1 space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-16 w-64 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center p-8 text-center", className)}>
        <h3 className="text-lg font-semibold">Channel not found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This channel may have been deleted or you don't have access.
        </p>
        {!isEmbedded && (
          <Button variant="outline" className="mt-4" onClick={() => navigate(backPath)}>
            Back to channels
          </Button>
        )}
      </div>
    );
  }

  // Determine display name and icon
  const displayName = isDM && dmInfo ? dmInfo.otherUserName : (channel.name || "Direct Message");
  const isOtherUserOnline = isDM && dmInfo?.otherUserId ? isUserOnline(dmInfo.otherUserId) : false;
  const ChannelIcon = channel.type === "private" ? Lock : channel.type === "dm" ? MessageCircle : Hash;

  // Get initials for DM avatar
  const dmInitials = dmInfo?.otherUserName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Channel Header */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b px-4">
        {/* Mobile Back Button */}
        {isMobile && !isEmbedded && (
          <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Channel/DM Icon or Avatar */}
        {isDM ? (
          <div className="relative flex-shrink-0">
            <Avatar className="h-8 w-8">
              <AvatarImage src={dmInfo?.otherUserAvatar || undefined} />
              <AvatarFallback className="text-xs">{dmInitials}</AvatarFallback>
            </Avatar>
            <OnlineIndicator
              isOnline={isOtherUserOnline}
              size="sm"
              className="absolute -bottom-0.5 -right-0.5"
            />
          </div>
        ) : (
          <ChannelIcon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        )}

        {/* Channel Name & Description */}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{displayName}</h2>
          {isDM && isOtherUserOnline ? (
            <p className="text-xs text-emerald-500">Online</p>
          ) : channel.description ? (
            <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
          ) : null}
        </div>

        {/* Member Count (hide for DMs) */}
        {!isDM && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{members.length}</span>
          </div>
        )}

        {/* Info Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="flex-shrink-0"
          onClick={() => setSettingsOpen(true)}
        >
          <Info className="h-5 w-5" />
        </Button>
      </div>

      {/* Message List or Empty State */}
      {messages.length === 0 ? (
        <ChatEmptyState channel={channel} channelName={displayName} />
      ) : (
        <MessageList 
          channelId={channel.id} 
          currentUserId={currentUserId}
          onReply={handleReply}
          onEdit={handleEdit}
        />
      )}

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Message Input */}
      <ChatInput 
        channelId={channel.id} 
        onTyping={broadcastTyping}
        editingMessage={editingMessage}
        replyingTo={replyingTo}
        onCancelEdit={handleCancelEdit}
        onCancelReply={handleCancelReply}
      />

      {/* Channel Settings Dialog */}
      <ChannelSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        channel={channel}
      />
    </div>
  );
}
