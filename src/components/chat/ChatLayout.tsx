import { useParams, useLocation } from "react-router-dom";
import { ChatChannelView } from "./ChatChannelView";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatSidebar } from "./ChatSidebar";
import { ChatEmptyState } from "./ChatEmptyState";

export function ChatLayout() {
  const isMobile = useIsMobile();
  const { channelId } = useParams();
  const location = useLocation();
  const isWorkerApp = location.pathname.startsWith("/worker");

  // Mobile: Show sidebar OR content, not both
  if (isMobile) {
    if (channelId) {
      // On mobile with a channel selected, show only the message thread
      return (
        <div className="flex h-full flex-col">
          <ChatChannelView />
        </div>
      );
    }
    // On mobile without a channel, show only the sidebar
    return (
      <div className="h-full">
        <ChatSidebar />
      </div>
    );
  }

  // Desktop: Two-pane layout
  return (
    <div className="flex h-full">
      <div className="w-64 flex-shrink-0">
        <ChatSidebar />
      </div>
      <div className="flex-1">
        {channelId ? <ChatChannelView /> : <ChatEmptyState />}
      </div>
    </div>
  );
}
