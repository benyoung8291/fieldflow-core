import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, ArrowRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserPresence {
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  currentPage?: string;
  currentField?: string;
  lastSeen: string;
}

const avatarColors = [
  "bg-primary",
  "bg-success",
  "bg-warning",
  "bg-info",
  "bg-secondary",
  "bg-destructive",
];

function getAvatarColor(userId: string): string {
  const index = userId.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getPageName(path: string): string {
  if (!path || path === '/') return 'Dashboard';
  
  const pathMap: Record<string, string> = {
    '/customers': 'Customers',
    '/scheduler': 'Scheduler',
    '/service-orders': 'Service Orders',
    '/invoices': 'Invoices',
    '/quotes': 'Quotes',
    '/projects': 'Projects',
    '/workers': 'Workers',
    '/helpdesk': 'Help Desk',
    '/analytics': 'Analytics',
    '/settings': 'Settings',
    '/tasks': 'Tasks',
    '/expenses': 'Expenses',
    '/leads': 'Leads',
    '/contacts': 'Contacts',
  };

  // Check for exact match
  if (pathMap[path]) return pathMap[path];

  // Check for detail pages
  if (path.includes('/customers/')) return 'Customer Details';
  if (path.includes('/scheduler/appointments/')) return 'Appointment Details';
  if (path.includes('/service-orders/')) return 'Service Order Details';
  if (path.includes('/invoices/')) return 'Invoice Details';
  if (path.includes('/quotes/')) return 'Quote Details';
  if (path.includes('/projects/')) return 'Project Details';
  if (path.includes('/workers/')) return 'Worker Details';

  return path.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
}

export default function PresencePanel() {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresence>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const presenceChannel = supabase.channel('presence-panel', {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel.presenceState();
          const users: Record<string, UserPresence> = {};
          
          Object.keys(state).forEach((key) => {
            const presences = state[key] as any[];
            if (presences.length > 0 && presences[0]) {
              const presence = presences[0];
              if (presence.userId && presence.userName && presence.userEmail) {
                users[key] = presence as UserPresence;
              }
            }
          });
          
          setOnlineUsers(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel.track({
              userId: user.id,
              userName: user.user_metadata?.first_name 
                ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
                : user.email?.split("@")[0] || "Anonymous",
              userEmail: user.email || "",
              userAvatar: user.user_metadata?.avatar_url,
              lastSeen: new Date().toISOString(),
              currentPage: window.location.pathname,
            });
          }
        });

      // Update presence on route change
      const updatePresence = () => {
        presenceChannel.track({
          userId: user.id,
          userName: user.user_metadata?.first_name 
            ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
            : user.email?.split("@")[0] || "Anonymous",
          userEmail: user.email || "",
          userAvatar: user.user_metadata?.avatar_url,
          lastSeen: new Date().toISOString(),
          currentPage: window.location.pathname,
        });
      };

      window.addEventListener('popstate', updatePresence);

      return () => {
        presenceChannel.unsubscribe();
        window.removeEventListener('popstate', updatePresence);
      };
    };

    initPresence();
  }, []);

  const otherUsers = Object.entries(onlineUsers)
    .filter(([userId]) => userId !== currentUserId)
    .map(([_, user]) => user);

  const handleFollowUser = (user: UserPresence) => {
    if (user.currentPage) {
      navigate(user.currentPage);
      setOpen(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Users className="h-4 w-4 mr-2" />
          Active Users
          {otherUsers.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 flex items-center justify-center p-1">
              {otherUsers.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Users ({otherUsers.length})
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-6">
          {otherUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No other users are currently active</p>
            </div>
          ) : (
            <div className="space-y-4">
              {otherUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="relative">
                    <Avatar className={cn(
                      "h-10 w-10 border-2 border-background",
                      !user.userAvatar && getAvatarColor(user.userId)
                    )}>
                      {user.userAvatar ? (
                        <AvatarImage src={user.userAvatar} alt={user.userName} />
                      ) : (
                        <AvatarFallback className="text-sm text-white">
                          {getInitials(user.userName)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full bg-success ring-2 ring-background" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.userName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Circle className="h-2 w-2 fill-success text-success" />
                      <p className="text-xs text-muted-foreground truncate">
                        {user.currentPage ? getPageName(user.currentPage) : 'Unknown'}
                      </p>
                    </div>
                    {user.currentField && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Editing: {user.currentField}
                      </p>
                    )}
                  </div>

                  {user.currentPage && user.currentPage !== window.location.pathname && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleFollowUser(user)}
                      className="shrink-0"
                    >
                      Follow
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
