import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Edit, Plus, Trash, Undo2, Settings, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

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

const tableLabels: Record<string, string> = {
  customers: "Customer",
  leads: "Lead",
  quotes: "Quote",
  projects: "Project",
  service_orders: "Service Order",
  service_contracts: "Service Contract",
  appointments: "Appointment",
  profiles: "Profile",
  menu_items: "Menu Item",
  role_permissions: "Role Permission",
  quote_templates: "Quote Template",
  customer_message_templates: "Message Template",
  task_templates: "Task Template",
  terms_templates: "Terms Template",
  pay_rate_categories: "Pay Rate Category",
  appointment_templates: "Appointment Template",
  price_book_items: "Price Book Item",
  price_book_assemblies: "Assembly",
  customer_contacts: "Contact",
  customer_locations: "Location",
  lead_contacts: "Lead Contact",
  lead_activities: "Lead Activity",
  quote_line_items: "Quote Line Item",
  tasks: "Task",
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

export const ActivityLogTab = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTable, setFilterTable] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity-audit-logs", filterTable, filterAction],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterTable !== "all") {
        query = query.eq("table_name", filterTable);
      }

      if (filterAction !== "all") {
        query = query.eq("action", filterAction);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredLogs = logs?.filter((log) => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.table_name?.toLowerCase().includes(searchLower) ||
      log.field_name?.toLowerCase().includes(searchLower) ||
      log.old_value?.toLowerCase().includes(searchLower) ||
      log.new_value?.toLowerCase().includes(searchLower)
    );
  });

  const uniqueTables = Array.from(new Set(logs?.map((log) => log.table_name) || [])).sort();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Activity Log</h3>
          <p className="text-sm text-muted-foreground">
            Complete history of all changes across your tenant
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Activity Log</h3>
        <p className="text-sm text-muted-foreground">
          Complete history of all changes across your tenant
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, table, field, or value..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Tables" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tables</SelectItem>
            {uniqueTables.map((table) => (
              <SelectItem key={table} value={table}>
                {tableLabels[table] || table}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Created</SelectItem>
            <SelectItem value="update">Updated</SelectItem>
            <SelectItem value="delete">Deleted</SelectItem>
            <SelectItem value="revert">Reverted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!filteredLogs || filteredLogs.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchQuery || filterTable !== "all" || filterAction !== "all"
              ? "No activity found matching your filters"
              : "No activity history available"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredLogs.map((log, index) => {
            const Icon = actionIcons[log.action as keyof typeof actionIcons] || Settings;
            const tableName = tableLabels[log.table_name] || log.table_name;

            return (
              <div key={log.id} className="relative">
                {index < filteredLogs.length - 1 && (
                  <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
                )}

                <div className="flex gap-4">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full border-2 border-background bg-card flex items-center justify-center shadow-sm flex-shrink-0",
                      actionColors[log.action as keyof typeof actionColors] || "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 space-y-2">
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge
                              variant="outline"
                              className={cn(
                                "capitalize",
                                actionColors[log.action as keyof typeof actionColors] || "text-muted-foreground"
                              )}
                            >
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
      )}
    </div>
  );
};
