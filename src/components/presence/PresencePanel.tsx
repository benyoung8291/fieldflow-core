import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Users } from "lucide-react";
import { ActivityAndUsers } from "@/components/dashboard/ActivityAndUsers";
import { usePresenceSystem } from "@/hooks/usePresenceSystem";
import { Badge } from "@/components/ui/badge";

export default function PresencePanel() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { onlineCount, isConnected, onlineUsers } = usePresenceSystem();

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 relative">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Team</span>
          {onlineCount > 0 && (
            <Badge 
              variant="default" 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 px-1.5 text-[10px] font-bold text-white shadow-sm"
            >
              {onlineCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[500px] p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Team Activity</SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100vh-73px)]">
          <ActivityAndUsers onlineUsers={onlineUsers} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
