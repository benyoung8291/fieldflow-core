import { useEffect, useRef, useLayoutEffect } from "react";
import { format, isToday, isYesterday, isSameDay, differenceInMinutes } from "date-fns";
import { useChannelMessages } from "@/hooks/chat/useChannelMessages";
import { useUpdateLastRead } from "@/hooks/chat/useChatOperations";
import { MessageWithProfile } from "@/types/chat";
import { MessageBubble } from "./MessageBubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  channelId: string;
  currentUserId: string;
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

export function MessageList({ channelId, currentUserId }: MessageListProps) {
  const { data: messages = [], isLoading, error } = useChannelMessages(channelId);
  const updateLastRead = useUpdateLastRead();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

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
    }
  }, [channelId, messages.length]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
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
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">No messages yet</p>
        <p className="text-sm text-muted-foreground">Be the first to send a message!</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col px-4 py-2">
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : null;
          const showDateSeparator = shouldShowDateSeparator(message, previousMessage);
          const isContinuous = !showDateSeparator && isContinuousMessage(message, previousMessage);
          const isCurrentUser = message.user_id === currentUserId;

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
              <MessageBubble
                message={message}
                isCurrentUser={isCurrentUser}
                isContinuous={isContinuous}
                currentUserId={currentUserId}
                channelId={channelId}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
