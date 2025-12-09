import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Download, Search, Eye, List, FileDown, FileText, RefreshCw } from "lucide-react";
import { useLogExportAction } from "@/hooks/useLogDetailPageAccess";

const ACTION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  view: { label: "View", icon: Eye, color: "bg-info/10 text-info" },
  list: { label: "List", icon: List, color: "bg-secondary/50 text-secondary-foreground" },
  export: { label: "Export", icon: FileDown, color: "bg-warning/10 text-warning" },
  download: { label: "Download", icon: FileText, color: "bg-success/10 text-success" },
  search: { label: "Search", icon: Search, color: "bg-muted text-muted-foreground" },
};

const TABLE_LABELS: Record<string, string> = {
  customers: "Customers",
  service_orders: "Service Orders",
  invoices: "Invoices",
  quotes: "Quotes",
  suppliers: "Suppliers",
  projects: "Projects",
  contacts: "Contacts",
  leads: "Leads",
  appointments: "Appointments",
  field_reports: "Field Reports",
  purchase_orders: "Purchase Orders",
  expenses: "Expenses",
  time_logs: "Time Logs",
};

interface AccessLog {
  id: string;
  user_id: string;
  user_name: string;
  table_name: string;
  record_id: string | null;
  action: string;
  metadata: any;
  user_agent: string | null;
  accessed_at: string;
}

export function AccessLogsTab() {
  const logExport = useLogExportAction();
  
  // Filters
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days" | "custom">("7days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case "7days":
        return { startDate: startOfDay(subDays(now, 7)), endDate: endOfDay(now) };
      case "30days":
        return { startDate: startOfDay(subDays(now, 30)), endDate: endOfDay(now) };
      case "custom":
        return {
          startDate: customStartDate ? startOfDay(new Date(customStartDate)) : startOfDay(subDays(now, 7)),
          endDate: customEndDate ? endOfDay(new Date(customEndDate)) : endOfDay(now),
        };
      default:
        return { startDate: startOfDay(subDays(now, 7)), endDate: endOfDay(now) };
    }
  }, [dateRange, customStartDate, customEndDate]);

  // Fetch access logs
  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ["access-logs", startDate, endDate, userFilter, tableFilter, actionFilter, searchQuery, page],
    queryFn: async () => {
      let query = supabase
        .from("data_access_logs")
        .select("*", { count: "exact" })
        .gte("accessed_at", startDate.toISOString())
        .lte("accessed_at", endDate.toISOString())
        .order("accessed_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (userFilter !== "all") {
        query = query.eq("user_id", userFilter);
      }
      if (tableFilter !== "all") {
        query = query.eq("table_name", tableFilter);
      }
      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (searchQuery.trim()) {
        query = query.or(`user_name.ilike.%${searchQuery}%,record_id.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { logs: data as AccessLog[], totalCount: count || 0 };
    },
  });

  // Fetch unique users for filter
  const { data: users = [] } = useQuery({
    queryKey: ["access-logs-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_access_logs")
        .select("user_id, user_name")
        .limit(1000);
      
      if (error) throw error;
      
      // Get unique users
      const uniqueUsers = new Map<string, string>();
      data?.forEach((log) => {
        if (log.user_id && log.user_name) {
          uniqueUsers.set(log.user_id, log.user_name);
        }
      });
      
      return Array.from(uniqueUsers.entries()).map(([id, name]) => ({ id, name }));
    },
  });

  // Fetch unique tables for filter
  const { data: tables = [] } = useQuery({
    queryKey: ["access-logs-tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_access_logs")
        .select("table_name")
        .limit(1000);
      
      if (error) throw error;
      
      const uniqueTables = new Set<string>();
      data?.forEach((log) => {
        if (log.table_name) {
          uniqueTables.add(log.table_name);
        }
      });
      
      return Array.from(uniqueTables).sort();
    },
  });

  const logs = logsData?.logs || [];
  const totalCount = logsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Export to CSV
  const handleExport = async () => {
    logExport("data_access_logs", undefined, { 
      dateRange,
      userFilter,
      tableFilter,
      actionFilter,
      exportedCount: totalCount
    });

    // Fetch all logs for export (max 10000)
    let query = supabase
      .from("data_access_logs")
      .select("*")
      .gte("accessed_at", startDate.toISOString())
      .lte("accessed_at", endDate.toISOString())
      .order("accessed_at", { ascending: false })
      .limit(10000);

    if (userFilter !== "all") query = query.eq("user_id", userFilter);
    if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
    if (actionFilter !== "all") query = query.eq("action", actionFilter);

    const { data } = await query;
    if (!data?.length) return;

    const headers = ["Date/Time", "User", "Table", "Record ID", "Action", "Metadata"];
    const rows = data.map((log: AccessLog) => [
      format(new Date(log.accessed_at), "yyyy-MM-dd HH:mm:ss"),
      log.user_name,
      TABLE_LABELS[log.table_name] || log.table_name,
      log.record_id || "-",
      ACTION_LABELS[log.action]?.label || log.action,
      JSON.stringify(log.metadata || {}),
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filters</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === "custom" && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Table</Label>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {tables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {TABLE_LABELS[table] || table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="search">Search</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="User name or record ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total Access Events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">Unique Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tables.length}</div>
            <p className="text-xs text-muted-foreground">Tables Accessed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Button variant="outline" onClick={handleExport} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Access Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No access logs found for the selected filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const actionConfig = ACTION_LABELS[log.action] || {
                        label: log.action,
                        icon: Eye,
                        color: "bg-muted text-muted-foreground",
                      };
                      const ActionIcon = actionConfig.icon;
                      
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(log.accessed_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>{log.user_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {TABLE_LABELS[log.table_name] || log.table_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.record_id ? log.record_id.slice(0, 8) + "..." : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge className={actionConfig.color}>
                              <ActionIcon className="h-3 w-3 mr-1" />
                              {actionConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                            {log.metadata && Object.keys(log.metadata).length > 0
                              ? JSON.stringify(log.metadata)
                              : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
