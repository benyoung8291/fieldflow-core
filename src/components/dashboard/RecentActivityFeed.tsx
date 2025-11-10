import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Activity, FileText, Briefcase, ClipboardList, DollarSign } from "lucide-react";

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
  if (tableName.includes("quote")) return FileText;
  if (tableName.includes("project")) return Briefcase;
  if (tableName.includes("service_order")) return ClipboardList;
  if (tableName.includes("invoice")) return DollarSign;
  return Activity;
};

const getActionColor = (action: string) => {
  if (action.toLowerCase().includes("create")) return "text-success";
  if (action.toLowerCase().includes("update")) return "text-warning";
  if (action.toLowerCase().includes("delete")) return "text-destructive";
  return "text-muted-foreground";
};

export function RecentActivityFeed() {
  const [activities, setActivities] = useState<AuditLog[]>([]);

  // Fetch initial activity logs
  const { data: initialLogs, isLoading } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .in("table_name", ["quotes", "projects", "service_orders", "invoices"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  // Set initial data
  useEffect(() => {
    if (initialLogs) {
      setActivities(initialLogs);
    }
  }, [initialLogs]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
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
          // Only show logs for relevant modules
          if (
            ["quotes", "projects", "service_orders", "invoices"].includes(
              newLog.table_name
            )
          ) {
            setActivities((prev) => [newLog, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            Live Updates
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((log) => {
                const Icon = getModuleIcon(log.table_name);
                const actionColor = getActionColor(log.action);

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="mt-1">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {log.user_name}
                        </span>
                        <span className={`text-sm ${actionColor}`}>
                          {log.action}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {log.table_name.replace(/_/g, " ")}
                        </span>
                      </div>
                      {log.note && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.note}
                        </p>
                      )}
                      {log.field_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Changed: {log.field_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(log.created_at), {
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
      </CardContent>
    </Card>
  );
}