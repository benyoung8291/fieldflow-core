import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface UserPresence {
  user_id: string;
  user_name: string;
  current_page: string;
  online_at: string;
}

interface PresenceState {
  [key: string]: UserPresence[];
}

export function ActiveUsers() {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);

  // Get current user info
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      return {
        id: user.id,
        name: profile
          ? `${profile.first_name} ${profile.last_name}`
          : user.email || "Unknown User",
      };
    },
  });

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel("dashboard-presence");

    channel
      .on("presence", { event: "sync" }, () => {
        const state: PresenceState = channel.presenceState();
        const users: UserPresence[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key];
          if (presences && presences.length > 0) {
            users.push(presences[0]);
          }
        });

        setActiveUsers(users);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        console.log("User joined:", newPresences);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        console.log("User left:", leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track current user's presence
          const currentPath = window.location.pathname;
          await channel.track({
            user_id: currentUser.id,
            user_name: currentUser.name,
            current_page: getPageName(currentPath),
            online_at: new Date().toISOString(),
          });
        }
      });

    // Update presence when route changes
    const handleRouteChange = () => {
      const currentPath = window.location.pathname;
      channel.track({
        user_id: currentUser.id,
        user_name: currentUser.name,
        current_page: getPageName(currentPath),
        online_at: new Date().toISOString(),
      });
    };

    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const getPageName = (path: string): string => {
    const routes: { [key: string]: string } = {
      "/dashboard": "Dashboard",
      "/service-orders": "Service Orders",
      "/quotes": "Quotes",
      "/projects": "Projects",
      "/invoices": "Invoices",
      "/scheduler": "Scheduler",
      "/customers": "Customers",
      "/workers": "Workers",
      "/tasks": "Tasks",
      "/leads": "Leads",
      "/settings": "Settings",
    };

    for (const [route, name] of Object.entries(routes)) {
      if (path.startsWith(route)) {
        return name;
      }
    }

    return "Viewing...";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Active Users
          <Badge variant="secondary" className="ml-auto">
            {activeUsers.length} online
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No active users</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeUsers.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials(user.user_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.user_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <p className="text-xs text-muted-foreground truncate">
                      {user.current_page}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}