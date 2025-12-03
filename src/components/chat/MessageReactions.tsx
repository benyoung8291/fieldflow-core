import { useState } from "react";
import { Smile } from "lucide-react";
import { useAddReaction, useRemoveReaction } from "@/hooks/chat/useChatOperations";
import { ChatReaction } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MessageReactionsProps {
  messageId: string;
  channelId: string;
  reactions: ChatReaction[];
  currentUserId: string;
  isCurrentUser: boolean;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
  userReactionId: string | null;
}

export function MessageReactions({
  messageId,
  channelId,
  reactions,
  currentUserId,
  isCurrentUser,
}: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();

  // Group reactions by emoji
  const groupedReactions: GroupedReaction[] = reactions.reduce((acc, reaction) => {
    const existing = acc.find((r) => r.emoji === reaction.emoji);
    if (existing) {
      existing.count++;
      existing.users.push(reaction.user_id);
      if (reaction.user_id === currentUserId) {
        existing.userReactionId = reaction.id;
      }
    } else {
      acc.push({
        emoji: reaction.emoji,
        count: 1,
        users: [reaction.user_id],
        userReactionId: reaction.user_id === currentUserId ? reaction.id : null,
      });
    }
    return acc;
  }, [] as GroupedReaction[]);

  const handleToggleReaction = async (emoji: string) => {
    const existingReaction = reactions.find(
      (r) => r.emoji === emoji && r.user_id === currentUserId
    );

    if (existingReaction) {
      await removeReaction.mutateAsync({ reactionId: existingReaction.id, channelId });
    } else {
      await addReaction.mutateAsync({ messageId, emoji, channelId });
    }
    setShowPicker(false);
  };

  const handleReactionClick = async (grouped: GroupedReaction) => {
    if (grouped.userReactionId) {
      await removeReaction.mutateAsync({ reactionId: grouped.userReactionId, channelId });
    } else {
      await addReaction.mutateAsync({ messageId, emoji: grouped.emoji, channelId });
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1 mt-1", isCurrentUser ? "justify-end" : "justify-start")}>
      {/* Existing reactions */}
      {groupedReactions.map((grouped) => (
        <button
          key={grouped.emoji}
          onClick={() => handleReactionClick(grouped)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
            grouped.userReactionId
              ? "bg-primary/20 text-primary hover:bg-primary/30"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          <span>{grouped.emoji}</span>
          <span className="font-medium">{grouped.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top" align={isCurrentUser ? "end" : "start"}>
          <div className="flex items-center gap-1">
            {QUICK_EMOJIS.map((emoji) => {
              const hasReacted = reactions.some(
                (r) => r.emoji === emoji && r.user_id === currentUserId
              );
              return (
                <button
                  key={emoji}
                  onClick={() => handleToggleReaction(emoji)}
                  className={cn(
                    "h-8 w-8 rounded flex items-center justify-center text-lg transition-colors",
                    hasReacted ? "bg-primary/20" : "hover:bg-muted"
                  )}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
