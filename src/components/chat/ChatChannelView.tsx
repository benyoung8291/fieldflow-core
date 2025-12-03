import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Hash, Lock, Users, Info, Search } from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ChatEmptyState } from "./ChatEmptyState";
import { TypingIndicator } from "./TypingIndicator";
import { ChannelSettingsDialog } from "./dialogs/ChannelSettingsDialog";
import { OnlineIndicator } from "./OnlineIndicator";
import { MessageSearch } from "./MessageSearch";
import { ImageLightbox } from "./ImageLightbox";
import { ConnectionStatus } from "./ConnectionStatus";
import { cn } from "@/lib/utils";

interface ChatChannelViewProps {
  channelId?: string;
  className?: string;
  isMobileFullScreen?: boolean;
}

export function ChatChannelView({ channelId: propChannelId, className, isMobileFullScreen }: ChatChannelViewProps) {
  const { channelId: paramChannelId } = useParams();
  const channelId = propChannelId || paramChannelId;
  const isEmbedded = !!propChannelId;
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { data: channel, isLoading: channelLoading } = useChatChannel(channelId || null);
  const { data: members = [] } = useChannelMembers(channelId || null);
  const { 
    data: messages = [], 
    isLoading: messagesLoading, 
    error: messagesError,
    connectionState,
    reconnect 
  } = useChannelMessages(channelId || "");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // DM specific hooks
  const isDM = channel?.type === "dm";
  const { data: dmInfo } = useDMChannelName(isDM ? channelId || null : null);
  const { isUserOnline } = useChatPresence();
  
  // Message action states
  const [editingMessage, setEditingMessage] = useState<MessageWithProfile | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageWithProfile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  
  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState<Array<{ url: string; name: string }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
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

  const handleImageClick = useCallback((images: Array<{ url: string; name: string }>, index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const handleSearchSelect = useCallback((messageId: string) => {
    setSearchOpen(false);
    setTimeout(() => {
      const element = document.getElementById(`message-${messageId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("bg-primary/10");
        element.style.transition = "background-color 0.3s ease";
        setTimeout(() => {
          element.classList.remove("bg-primary/10");
        }, 2000);
      }
    }, 100);
  }, []);

  if (channelLoading) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="flex h-12 items-center gap-3 border-b px-4">
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
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-64" />
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

  // Get initials for DM avatar
  const dmInitials = dmInfo?.otherUserName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Connection Status */}
      <ConnectionStatus 
        isConnected={connectionState.isConnected} 
        isReconnecting={connectionState.isReconnecting}
        onReconnect={reconnect}
      />

      {/* Channel Header - Slack style */}
      <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b px-4">
        {/* Mobile Back Button */}
        {isMobile && !isEmbedded && (
          <Button variant="ghost" size="icon" className="flex-shrink-0 -ml-2" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Channel Name with Icon */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isDM ? (
            <div className="relative flex-shrink-0">
              <Avatar className="h-6 w-6">
                <AvatarImage src={dmInfo?.otherUserAvatar || undefined} />
                <AvatarFallback className="text-[10px] bg-slack-avatar text-slack-avatar-foreground">{dmInitials}</AvatarFallback>
              </Avatar>
              <OnlineIndicator
                isOnline={isOtherUserOnline}
                size="xs"
                className="absolute -bottom-0.5 -right-0.5"
              />
            </div>
          ) : channel.type === "private" ? (
            <Lock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          ) : (
            <Hash className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
          
          <h2 className="font-bold text-base truncate max-w-[200px]" title={displayName}>{displayName}</h2>

          {/* Description/Status - inline on desktop */}
          {!isMobile && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              {isDM && isOtherUserOnline ? (
                <span className="text-xs text-slack-online flex-shrink-0">Active</span>
              ) : channel.description ? (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{channel.description}</span>
              ) : null}
            </>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Member Count (hide for DMs) */}
          {!isDM && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">{members.length}</span>
            </Button>
          )}

          {/* Search Button */}
          <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Search className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-96 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Search Messages</SheetTitle>
              </SheetHeader>
              <MessageSearch
                channelId={channel.id}
                onSelectMessage={handleSearchSelect}
                onClose={() => setSearchOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Info Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setSettingsOpen(true)}
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Message List or Empty State */}
      {messages.length === 0 && !messagesLoading ? (
        <ChatEmptyState channel={channel} channelName={displayName} />
      ) : (
        <MessageList 
          channelId={channel.id} 
          currentUserId={currentUserId}
          messages={messages}
          isLoading={messagesLoading}
          error={messagesError}
          onReply={handleReply}
          onEdit={handleEdit}
          onImageClick={handleImageClick}
        />
      )}

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Message Input */}
      <ChatInput 
        channelId={channel.id}
        channelName={displayName}
        onTyping={broadcastTyping}
        editingMessage={editingMessage}
        replyingTo={replyingTo}
        onCancelEdit={handleCancelEdit}
        onCancelReply={handleCancelReply}
        isMobileFullScreen={isMobileFullScreen}
      />

      {/* Channel Settings Dialog */}
      <ChannelSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        channel={channel}
      />

      {/* Image Lightbox */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
