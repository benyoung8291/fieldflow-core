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
      // Bottom nav is hidden so we use full viewport height
      return (
        <div className="flex h-[100dvh] flex-col bg-background">
          <ChatChannelView className="flex-1 min-h-0" isMobileFullScreen />
        </div>
      );
    }
    // On mobile without a channel, show the sidebar with bottom padding for nav
    return (
      <div className="flex h-[100dvh] flex-col pb-20">
        <ChatSidebar />
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
