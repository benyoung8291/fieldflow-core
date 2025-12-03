import { Hash, Lock, MessageCircle, MessageSquare, Send } from "lucide-react";
import { ChatChannel } from "@/types/chat";
import { cn } from "@/lib/utils";

interface ChatEmptyStateProps {
  channel?: ChatChannel | null;
  channelName?: string;
  className?: string;
}

export function ChatEmptyState({ channel, channelName, className }: ChatEmptyStateProps) {
  // No channel selected state
  if (!channel) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center bg-background p-8 text-center", className)}>
        <div className="rounded-full bg-muted p-4">
          <MessageSquare className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Select a channel</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Choose a channel from the sidebar to start chatting, or create a new one.
        </p>
      </div>
    );
  }

  const getIcon = () => {
    switch (channel.type) {
      case "private":
        return Lock;
      case "dm":
        return MessageCircle;
      default:
        return Hash;
    }
  };

  const Icon = getIcon();
  const displayName = channelName || channel.name || "this channel";

  const getTitle = () => {
    if (channel.type === "dm") return "Start a conversation";
    return `Welcome to #${displayName}`;
  };

  const getDescription = () => {
    if (channel.type === "dm") {
      return "This is the beginning of your direct message history. Say hi! 👋";
    }
    if (channel.type === "private") {
      return `This is the start of the private channel #${displayName}. Only invited members can see this channel.`;
    }
    return `This is the very beginning of the #${displayName} channel. Start the conversation!`;
  };

  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center p-8 text-center", className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-xl font-semibold">{getTitle()}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {getDescription()}
      </p>
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Send className="h-4 w-4" />
        <span>Type a message below to get started</span>
      </div>
    </div>
  );
}
