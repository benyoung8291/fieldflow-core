import { useParams, useLocation } from "react-router-dom";
import { ChatChannelView } from "@/components/chat/ChatChannelView";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";

export default function WorkerChat() {
  const isMobile = useIsMobile();
  const { channelId } = useParams();
  const location = useLocation();

  // Mobile: Show sidebar OR content, not both
  if (isMobile) {
    if (channelId) {
      // On mobile with a channel selected, show full-screen chat
      // Use fixed positioning to overlay above the bottom nav
      return (
        <div className="fixed inset-0 z-40 flex flex-col bg-background">
          <ChatChannelView className="flex-1 min-h-0" isMobileFullScreen />
        </div>
      );
    }
    // On mobile without a channel, show the sidebar with proper bottom padding for nav
    return (
      <div className="flex h-[calc(100dvh-5rem)] flex-col pb-20">
        <div className="flex-1 overflow-hidden">
          <ChatSidebar />
        </div>
      </div>
    );
  }

  // Desktop/Tablet: Two-pane layout
  return (
    <div className="flex h-[calc(100vh-5rem)] pb-20">
      <div className="w-64 flex-shrink-0">
        <ChatSidebar />
      </div>
      <div className="flex-1 border-l">
        {channelId ? <ChatChannelView /> : <ChatEmptyState />}
      </div>
    </div>
  );
}
