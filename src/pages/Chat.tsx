import DashboardLayout from "@/components/DashboardLayout";
import { ChatLayout } from "@/components/chat/ChatLayout";

export default function Chat() {
  return (
    <DashboardLayout noPadding>
      <div className="h-[calc(100vh-4rem)]">
        <ChatLayout />
      </div>
    </DashboardLayout>
  );
}
