import { Outlet, useParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChatSidebar } from "./ChatSidebar";

export function ChatLayout() {
  const isMobile = useIsMobile();
  const { channelId } = useParams();

  // Mobile: Show sidebar OR content, not both
  if (isMobile) {
    if (channelId) {
      // On mobile with a channel selected, show only the message thread
      return (
        <div className="flex h-full flex-col">
          <Outlet />
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
        <Outlet />
      </div>
    </div>
  );
}
