import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Users } from "lucide-react";
import { ActivityAndUsers } from "@/components/dashboard/ActivityAndUsers";

export default function PresencePanel() {
  const [activeUserCount, setActiveUserCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const presenceChannel = supabase.channel('dashboard-presence');

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        // Count unique users excluding self
        const userCount = Object.keys(state).length;
        setActiveUserCount(userCount > 0 ? userCount - 1 : 0);
      })
      .subscribe();

    return () => {
      presenceChannel.unsubscribe();
    };
  }, []);

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Team</span>
          {activeUserCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-semibold text-white">
              {activeUserCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[500px] p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Team Activity</SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100vh-73px)]">
          <ActivityAndUsers />
        </div>
      </SheetContent>
    </Sheet>
  );
}
