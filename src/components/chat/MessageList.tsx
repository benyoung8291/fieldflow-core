import { useEffect, useRef, useLayoutEffect, useCallback, useState } from "react";
import { format, isToday, isYesterday, isSameDay, differenceInMinutes } from "date-fns";
import { useUpdateLastRead } from "@/hooks/chat/useChatOperations";
import { MessageWithProfile } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { UnreadDivider } from "./UnreadDivider";
import { MessageSkeleton } from "./MessageSkeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  channelId: string;
  currentUserId: string;
  lastReadAt?: string;
  messages: MessageWithProfile[];
  isLoading: boolean;
  error: Error | null;
  onReply?: (message: MessageWithProfile) => void;
  onEdit?: (message: MessageWithProfile) => void;
  onImageClick?: (images: Array<{ url: string; name: string }>, index: number) => void;
}

function formatDateSeparator(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function shouldShowDateSeparator(
  currentMessage: MessageWithProfile,
  previousMessage: MessageWithProfile | null
): boolean {
  if (!previousMessage) return true;
  const currentDate = new Date(currentMessage.created_at);
  const previousDate = new Date(previousMessage.created_at);
  return !isSameDay(currentDate, previousDate);
}

function isContinuousMessage(
  currentMessage: MessageWithProfile,
  previousMessage: MessageWithProfile | null
): boolean {
  if (!previousMessage) return false;
  if (previousMessage.user_id !== currentMessage.user_id) return false;
  
  const currentTime = new Date(currentMessage.created_at);
  const previousTime = new Date(previousMessage.created_at);
  const minutesDiff = differenceInMinutes(currentTime, previousTime);
  
  return minutesDiff <= 5;
}

export function MessageList({ 
  channelId, 
  currentUserId, 
  lastReadAt,
  messages,
  isLoading,
  error,
  onReply, 
  onEdit,
  onImageClick,
}: MessageListProps) {
  const updateLastRead = useUpdateLastRead();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const [showUnreadDivider, setShowUnreadDivider] = useState(false);
  const unreadDividerIndexRef = useRef<number | null>(null);

  // Calculate unread divider position
  useEffect(() => {
    if (!lastReadAt || messages.length === 0) {
      unreadDividerIndexRef.current = null;
      setShowUnreadDivider(false);
      return;
    }

    const lastReadTime = new Date(lastReadAt).getTime();
    const firstUnreadIndex = messages.findIndex((msg) => {
      const msgTime = new Date(msg.created_at).getTime();
      return msgTime > lastReadTime && msg.user_id !== currentUserId;
    });

    if (firstUnreadIndex > 0) {
      unreadDividerIndexRef.current = firstUnreadIndex;
      setShowUnreadDivider(true);
    } else {
      unreadDividerIndexRef.current = null;
      setShowUnreadDivider(false);
    }
  }, [messages, lastReadAt, currentUserId]);

  // Initial scroll to bottom
  useLayoutEffect(() => {
    if (messages.length > 0 && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [channelId]);

  // Scroll on new messages
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Update last read when viewing
  useEffect(() => {
    if (channelId && messages.length > 0) {
      updateLastRead.mutate(channelId);
      // Clear unread divider after marking as read
      const timer = setTimeout(() => {
        setShowUnreadDivider(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [channelId, messages.length]);

  // Scroll to a specific message and highlight it
  const handleScrollToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add highlight animation
      element.classList.add("bg-primary/10");
      element.style.transition = "background-color 0.3s ease";
      setTimeout(() => {
        element.classList.remove("bg-primary/10");
      }, 2000);
    }
  }, []);

  if (isLoading) {
    return (
      <ScrollArea className="flex-1">
        <MessageSkeleton count={8} />
      </ScrollArea>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-destructive">Failed to load messages</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return null; // Let parent component handle empty state with channel context
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col px-4 py-1 space-y-0.5">
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
          const isContinuous = !showDateSeparator && isContinuousMessage(message, previousMessage);
          const isCurrentUser = message.user_id === currentUserId;
          const showUnread = showUnreadDivider && index === unreadDividerIndexRef.current;

          return (
            <div key={message.id}>
              {showDateSeparator && (
                <div className="my-4 flex items-center gap-4">
                  <Separator className="flex-1" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDateSeparator(new Date(message.created_at))}
                  </span>
                  <Separator className="flex-1" />
                </div>
              )}
              {showUnread && <UnreadDivider />}
              <MessageBubble
                message={message}
                isCurrentUser={isCurrentUser}
                isContinuous={isContinuous}
                currentUserId={currentUserId}
                channelId={channelId}
                onReply={onReply}
                onEdit={onEdit}
                onScrollToMessage={handleScrollToMessage}
                onImageClick={onImageClick}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
