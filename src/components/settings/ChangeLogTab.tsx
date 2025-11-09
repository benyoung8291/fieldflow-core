import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Edit, Plus, Trash, Undo2, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const actionIcons = {
  create: Plus,
  update: Edit,
  delete: Trash,
  revert: Undo2,
};

const actionColors = {
  create: "text-success",
  update: "text-info",
  delete: "text-destructive",
  revert: "text-warning",
};

const actionLabels = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  revert: "Reverted",
};

const settingsTableLabels: Record<string, string> = {
  menu_items: "Menu Item",
  role_permissions: "Role Permission",
  quote_templates: "Quote Template",
  customer_message_templates: "Message Template",
  task_templates: "Task Template",
  terms_templates: "Terms Template",
  pay_rate_categories: "Pay Rate Category",
  appointment_templates: "Appointment Template",
};

function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: string | undefined): string {
  if (!value) return "—";
  if (value === "null" || value === "undefined") return "—";
  
  if (value.length > 100) {
    return value.substring(0, 100) + "...";
  }
  
  return value;
}

export const ChangeLogTab = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["settings-audit-logs"],
    queryFn: async () => {
      const settingsTables = [
        "menu_items",
        "role_permissions",
        "quote_templates",
        "customer_message_templates",
        "task_templates",
        "terms_templates",
        "pay_rate_categories",
        "appointment_templates",
      ];

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .in("table_name", settingsTables)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Change Log</h3>
          <p className="text-sm text-muted-foreground">
            Complete history of all changes made to settings
          </p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-muted"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Change Log</h3>
          <p className="text-sm text-muted-foreground">
            Complete history of all changes made to settings
          </p>
        </div>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No change history available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Change Log</h3>
        <p className="text-sm text-muted-foreground">
          Complete history of all changes made to settings
        </p>
      </div>

      <div className="space-y-6">
        {logs.map((log, index) => {
          const Icon = actionIcons[log.action as keyof typeof actionIcons] || Settings;
          const tableName = settingsTableLabels[log.table_name] || log.table_name;

          return (
            <div key={log.id} className="relative">
              {index < logs.length - 1 && (
                <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
              )}

              <div className="flex gap-4">
                <div className={cn(
                  "h-10 w-10 rounded-full border-2 border-background bg-card flex items-center justify-center shadow-sm flex-shrink-0",
                  actionColors[log.action as keyof typeof actionColors] || "text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                </div>

                <div className="flex-1 space-y-2">
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className={cn(
                            "capitalize", 
                            actionColors[log.action as keyof typeof actionColors] || "text-muted-foreground"
                          )}>
                            {actionLabels[log.action as keyof typeof actionLabels] || log.action}
                          </Badge>
                          <Badge variant="secondary" className="gap-1">
                            <Settings className="h-3 w-3" />
                            {tableName}
                          </Badge>
                          {log.field_name && (
                            <span className="text-sm font-medium">
                              {formatFieldName(log.field_name)}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          by <span className="font-medium text-foreground">{log.user_name}</span>
                          {" • "}
                          {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                      </div>
                    </div>

                    {log.action === "update" && log.field_name && (
                      <div className="space-y-2">
                        <Separator />
                        <div className="grid grid-cols-2 gap-4 text-sm py-2">
                          <div>
                            <div className="text-muted-foreground mb-1">From:</div>
                            <div className="font-mono text-xs bg-muted p-2 rounded">
                              {formatValue(log.old_value)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">To:</div>
                            <div className="font-mono text-xs bg-primary/5 p-2 rounded border border-primary/20">
                              {formatValue(log.new_value)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {log.note && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-sm">
                          <div className="text-muted-foreground mb-1">Note:</div>
                          <div className="text-foreground">{log.note}</div>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
