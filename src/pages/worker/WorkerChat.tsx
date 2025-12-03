import { Outlet, useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";

export default function WorkerChat() {
  const isMobile = useIsMobile();
  const { channelId } = useParams();

  // Mobile: Show sidebar OR content, not both
  if (isMobile) {
    if (channelId) {
      // On mobile with a channel selected, show only the message thread
      return (
        <div className="flex h-[calc(100vh-5rem)] flex-col pb-20">
          <Outlet />
        </div>
      );
    }
    // On mobile without a channel, show only the sidebar
    return (
      <div className="h-[calc(100vh-5rem)] pb-20">
        <ChatSidebar />
      </div>
    );
  }

  // Desktop/Tablet: Two-pane layout
  return (
    <div className="flex h-[calc(100vh-5rem)] pb-20">
      <div className="w-64 flex-shrink-0 border-r">
        <ChatSidebar />
      </div>
      <div className="flex-1">
        {channelId ? <Outlet /> : <ChatEmptyState />}
      </div>
    </div>
  );
}
