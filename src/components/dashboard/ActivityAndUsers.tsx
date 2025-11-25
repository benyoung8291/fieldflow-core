import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Activity, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserPresence {
  user_id: string;
  user_name: string;
  current_page: string;
  current_path: string;
  online_at: string;
}

interface PresenceState {
  [key: string]: UserPresence[];
}

interface GroupedUser {
  user_id: string;
  user_name: string;
  pages: Array<{ page: string; path: string }>;
  online_at: string;
}

interface AuditLog {
  id: string;
  user_name: string;
  action: string;
  record_id: string;
  table_name: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  note: string | null;
}

const getModuleIcon = (tableName: string) => {
  const icons: Record<string, any> = {
    quotes: "📄",
    projects: "💼",
    service_orders: "📋",
    invoices: "💵",
    helpdesk_tickets: "✉️",
  };
  return icons[tableName] || "📝";
};

const getActionColor = (action: string) => {
  if (action.toLowerCase().includes("create")) return "text-success";
  if (action.toLowerCase().includes("update")) return "text-warning";
  if (action.toLowerCase().includes("delete")) return "text-destructive";
  return "text-muted-foreground";
};

export function ActivityAndUsers() {
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const navigate = useNavigate();

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

  // Fetch initial activity logs
  const { data: initialLogs } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .in("table_name", ["quotes", "projects", "service_orders", "invoices", "helpdesk_tickets"])
        .order("created_at", { ascending: false })
        .limit(15);

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  // Set initial activity data
  useEffect(() => {
    if (initialLogs) {
      setActivities(initialLogs);
    }
  }, [initialLogs]);

  // Subscribe to presence and activity updates
  useEffect(() => {
    if (!currentUser) return;

    // Presence channel - use global channel to match other components
    const presenceChannel = supabase.channel("team-presence-global");

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state: PresenceState = presenceChannel.presenceState();
        const users: UserPresence[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key];
          if (presences && presences.length > 0) {
            presences.forEach((presence) => {
              users.push(presence);
            });
          }
        });

        setActiveUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const currentPath = window.location.pathname;
          await presenceChannel.track({
            user_id: currentUser.id,
            user_name: currentUser.name,
            current_page: getPageName(currentPath),
            current_path: currentPath,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Activity channel
    const activityChannel = supabase
      .channel("audit-logs-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        (payload) => {
          const newLog = payload.new as AuditLog;
          if (
            ["quotes", "projects", "service_orders", "invoices", "helpdesk_tickets"].includes(
              newLog.table_name
            )
          ) {
            setActivities((prev) => [newLog, ...prev].slice(0, 15));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(activityChannel);
    };
  }, [currentUser]);

  const getPageName = (path: string): string => {
    const routes: { [key: string]: string } = {
      "/dashboard": "Dashboard",
      "/helpdesk": "Help Desk",
      "/service-orders": "Service Orders",
      "/quotes": "Quotes",
      "/projects": "Projects",
      "/invoices": "Invoices",
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

  const getInitials = (name: string | undefined) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getModuleRoute = (tableName: string, recordId: string) => {
    const routes: { [key: string]: string } = {
      quotes: "/quotes",
      projects: "/projects",
      service_orders: "/service-orders",
      invoices: "/invoices",
      helpdesk_tickets: "/helpdesk",
    };

    const basePath = routes[tableName];
    return basePath ? `${basePath}/${recordId}` : null;
  };

  // Group users by user_id
  const groupedUsers: GroupedUser[] = activeUsers.reduce((acc, user) => {
    const existingUser = acc.find((u) => u.user_id === user.user_id);

    if (existingUser) {
      const pageExists = existingUser.pages.some(
        (p) => p.path === user.current_path
      );
      if (!pageExists) {
        existingUser.pages.push({
          page: user.current_page,
          path: user.current_path,
        });
      }
    } else {
      acc.push({
        user_id: user.user_id,
        user_name: user.user_name,
        pages: [{ page: user.current_page, path: user.current_path }],
        online_at: user.online_at,
      });
    }

    return acc;
  }, [] as GroupedUser[]);

  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="users" className="text-xs">
          <Users className="h-3 w-3 mr-1" />
          Users ({groupedUsers.length})
        </TabsTrigger>
        <TabsTrigger value="activity" className="text-xs">
          <Activity className="h-3 w-3 mr-1" />
          Activity
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users" className="mt-2">
        <ScrollArea className="h-[calc(100vh-200px)]">
          {groupedUsers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs">
              No active users
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {groupedUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                >
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {getInitials(user.user_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {user.user_name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse flex-shrink-0" />
                      <div className="flex-1 flex flex-wrap items-center gap-1">
                        {user.pages.map((pageInfo, index) => (
                          <span key={index} className="inline-flex items-center">
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => navigate(pageInfo.path)}
                              className="h-auto p-0 text-[10px] text-muted-foreground hover:text-primary"
                            >
                              {pageInfo.page}
                              <ExternalLink className="ml-0.5 h-2.5 w-2.5" />
                            </Button>
                            {index < user.pages.length - 1 && (
                              <span className="text-[10px] text-muted-foreground mx-1">
                                ,
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </TabsContent>

      <TabsContent value="activity" className="mt-2">
        <ScrollArea className="h-[calc(100vh-200px)]">
          {activities.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs">
              No recent activity
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {activities.map((activity) => {
                const route = getModuleRoute(
                  activity.table_name,
                  activity.record_id
                );

                return (
                  <div
                    key={activity.id}
                    onClick={() => route && navigate(route)}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-lg transition-colors text-xs",
                      route
                        ? "bg-muted/50 hover:bg-muted cursor-pointer"
                        : "bg-muted/30"
                    )}
                  >
                    <span className="text-base flex-shrink-0 mt-0.5">
                      {getModuleIcon(activity.table_name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium", getActionColor(activity.action))}>
                        {activity.user_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {activity.action} {activity.table_name.replace("_", " ")}
                        {activity.field_name && ` • ${activity.field_name}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(activity.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

// Helper cn function
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
