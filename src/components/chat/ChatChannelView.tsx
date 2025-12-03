import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatChannel } from "@/hooks/chat/useChatChannels";
import { Button } from "@/components/ui/button";

export function ChatChannelView() {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: channel, isLoading } = useChatChannel(channelId || null);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-muted-foreground">Loading channel...</span>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <h3 className="text-lg font-semibold">Channel not found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This channel may have been deleted or you don't have access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/chat")}>
          Back to channels
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Channel Header */}
      <div className="flex h-14 items-center gap-3 border-b px-4">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="flex-1">
          <h2 className="font-semibold">{channel.name || "Direct Message"}</h2>
          {channel.description && (
            <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
          )}
        </div>
      </div>

      {/* Placeholder for Message List */}
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Message list will be implemented in Phase 4</p>
      </div>

      {/* Placeholder for Message Input */}
      <div className="border-t p-4">
        <div className="rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground">
          Message input will be implemented in Phase 4
        </div>
      </div>
    </div>
  );
}
