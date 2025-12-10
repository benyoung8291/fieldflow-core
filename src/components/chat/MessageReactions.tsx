import { useState, useRef, useCallback } from "react";
import { Smile } from "lucide-react";
import { useAddReaction, useRemoveReaction } from "@/hooks/chat/useChatOperations";
import { ChatReaction } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MessageReactionsProps {
  messageId: string;
  channelId: string;
  reactions: ChatReaction[];
  currentUserId: string;
  isCurrentUser: boolean;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

interface ReactorProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: ReactorProfile[];
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
  const [showReactorsSheet, setShowReactorsSheet] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<GroupedReaction | null>(null);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();

  // Group reactions by emoji with user profiles
  const groupedReactions: GroupedReaction[] = reactions.reduce((acc, reaction) => {
    const existing = acc.find((r) => r.emoji === reaction.emoji);
    const userName = reaction.profile 
      ? `${reaction.profile.first_name || ''} ${reaction.profile.last_name || ''}`.trim() || 'Unknown'
      : 'Unknown';
    
    const userProfile: ReactorProfile = {
      id: reaction.user_id,
      name: userName,
      avatarUrl: reaction.profile?.avatar_url || null,
    };

    if (existing) {
      existing.count++;
      existing.users.push(userProfile);
      if (reaction.user_id === currentUserId) {
        existing.userReactionId = reaction.id;
      }
    } else {
      acc.push({
        emoji: reaction.emoji,
        count: 1,
        users: [userProfile],
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

  // Long press handlers for mobile
  const handleTouchStart = useCallback((reaction: GroupedReaction) => {
    longPressTimeout.current = setTimeout(() => {
      setSelectedReaction(reaction);
      setShowReactorsSheet(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatReactorNames = (users: ReactorProfile[]) => {
    if (users.length === 1) return users[0].name;
    if (users.length === 2) return `${users[0].name} and ${users[1].name}`;
    return `${users[0].name}, ${users[1].name} and ${users.length - 2} more`;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {/* Existing reactions */}
        {groupedReactions.map((grouped) => (
          <Tooltip key={grouped.emoji}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleReactionClick(grouped)}
                onTouchStart={() => handleTouchStart(grouped)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all select-none",
                  "border hover:scale-105 active:scale-95",
                  grouped.userReactionId
                    ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                    : "bg-muted/50 border-border/50 hover:bg-muted hover:border-border"
                )}
              >
                <span className="text-sm">{grouped.emoji}</span>
                <span className="font-medium tabular-nums">{grouped.count}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="max-w-[200px] hidden md:block"
            >
              <p className="text-xs">{formatReactorNames(grouped.users)}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Add reaction button */}
        <Popover open={showPicker} onOpenChange={setShowPicker}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 rounded-full transition-opacity",
                "opacity-0 group-hover:opacity-100 focus:opacity-100",
                "hover:bg-muted"
              )}
            >
              <Smile className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-2" 
            side="top" 
            align={isCurrentUser ? "end" : "start"}
          >
            <div className="flex items-center gap-0.5">
              {QUICK_EMOJIS.map((emoji) => {
                const hasReacted = reactions.some(
                  (r) => r.emoji === emoji && r.user_id === currentUserId
                );
                return (
                  <button
                    key={emoji}
                    onClick={() => handleToggleReaction(emoji)}
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center text-xl transition-all",
                      "hover:scale-110 active:scale-95",
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

        {/* Mobile long-press sheet to show who reacted */}
        <Sheet open={showReactorsSheet} onOpenChange={setShowReactorsSheet}>
          <SheetContent side="bottom" className="max-h-[50vh]">
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">
                <span className="text-2xl">{selectedReaction?.emoji}</span>
                <span>Reactions</span>
              </SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-3 overflow-y-auto">
              {selectedReaction?.users.map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs bg-muted">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
