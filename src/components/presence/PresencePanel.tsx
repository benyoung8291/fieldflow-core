import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Circle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ActivityAndUsers } from "@/components/dashboard/ActivityAndUsers";

interface UserPresence {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  currentPage?: string;
  currentField?: string;
  lastSeen: string;
  status?: 'available' | 'busy' | 'away';
}

function getStatusColor(status?: 'available' | 'busy' | 'away'): string {
  switch (status) {
    case 'available':
      return 'bg-success';
    case 'busy':
      return 'bg-destructive';
    case 'away':
      return 'bg-warning';
    default:
      return 'bg-muted';
  }
}

function getStatusLabel(status?: 'available' | 'busy' | 'away'): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'busy':
      return 'Busy';
    case 'away':
      return 'Away';
    default:
      return 'Unknown';
  }
}

export default function PresencePanel() {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresence>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserStatus, setCurrentUserStatus] = useState<'available' | 'busy' | 'away'>('available');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const activeUserCount = Object.keys(onlineUsers).filter(id => id !== currentUserId).length;

  useEffect(() => {
    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Fetch user's current status
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

      if (profile?.status) {
        setCurrentUserStatus(profile.status as 'available' | 'busy' | 'away');
      }

      const presenceChannel = supabase.channel('global-presence');

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const users: Record<string, UserPresence> = {};
          
          Object.entries(state).forEach(([key, value]) => {
            if (Array.isArray(value) && value[0]) {
              users[key] = value[0] as UserPresence;
            }
          });
          
          setOnlineUsers(users);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          setOnlineUsers(prev => ({
            ...prev,
            [key]: newPresences[0] as UserPresence
          }));
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          setOnlineUsers(prev => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
          });
        })
        .subscribe();

      return () => {
        presenceChannel.unsubscribe();
      };
    };

    initPresence();
  }, []);

  const handleStatusChange = async (newStatus: 'available' | 'busy' | 'away') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ 
          // @ts-ignore - Types will update after migration
          status: newStatus, 
          status_updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);

      setCurrentUserStatus(newStatus);
      toast.success(`Status changed to ${getStatusLabel(newStatus)}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Active Users Count & Sidebar Toggle */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Team</span>
            {activeUserCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
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

      {/* Status Dropdown - Separate */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Circle className={cn("h-2 w-2 fill-current", getStatusColor(currentUserStatus))} />
            <span className="hidden sm:inline">{getStatusLabel(currentUserStatus)}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => handleStatusChange('available')}>
            <Circle className="mr-2 h-2 w-2 fill-success bg-success" />
            Available
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange('busy')}>
            <Circle className="mr-2 h-2 w-2 fill-destructive bg-destructive" />
            Busy
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleStatusChange('away')}>
            <Circle className="mr-2 h-2 w-2 fill-warning bg-warning" />
            Away
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
