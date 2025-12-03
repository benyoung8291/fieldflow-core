import { useParams } from "react-router-dom";
import { ChatChannelView } from "@/components/chat/ChatChannelView";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { BottomTabNav } from "@/components/chat/BottomTabNav";

export default function WorkerChat() {
  const isMobile = useIsMobile();
  const { channelId } = useParams();

  // Mobile: Show sidebar OR content, not both
  if (isMobile) {
    if (channelId) {
      // On mobile with a channel selected, show only the message thread
      return (
        <div className="flex h-[calc(100vh-5rem)] flex-col pb-14">
          <ChatChannelView />
        </div>
      );
    }
    // On mobile without a channel, show the sidebar with bottom nav
    return (
      <div className="flex h-[calc(100vh-5rem)] flex-col">
        <div className="flex-1 overflow-hidden">
          <ChatSidebar />
        </div>
        <BottomTabNav />
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
