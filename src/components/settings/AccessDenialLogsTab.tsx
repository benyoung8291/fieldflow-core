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
import { Download, Search, ShieldAlert, RefreshCw, AlertTriangle } from "lucide-react";

const REASON_LABELS: Record<string, { label: string; severity: "high" | "medium" | "low" }> = {
  customer_only_user_accessing_non_portal_route: { label: "Customer accessing office", severity: "high" },
  unauthorized_customer_portal_access: { label: "Unauthorized portal access", severity: "medium" },
  worker_only_user_accessing_office_route: { label: "Worker accessing office", severity: "high" },
  unauthorized_worker_app_access: { label: "Unauthorized worker access", severity: "medium" },
  no_office_access: { label: "No office access", severity: "medium" },
  super_admin_required: { label: "Super admin required", severity: "low" },
  missing_module_permission: { label: "Missing permission", severity: "low" },
  supervisor_role_required: { label: "Supervisor required", severity: "low" },
};

interface AccessDenialLog {
  id: string;
  user_id: string | null;
  user_name: string;
  table_name: string;
  action: string;
  metadata: any;
  user_agent: string | null;
  accessed_at: string;
}

export function AccessDenialLogsTab() {
  // Filters
  const [dateRange, setDateRange] = useState<"today" | "7days" | "30days" | "custom">("7days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
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

  // Fetch access denial logs
  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ["access-denial-logs", startDate, endDate, userFilter, reasonFilter, searchQuery, page],
    queryFn: async () => {
      let query = supabase
        .from("data_access_logs")
        .select("*", { count: "exact" })
        .eq("action", "access_denied")
        .gte("accessed_at", startDate.toISOString())
        .lte("accessed_at", endDate.toISOString())
        .order("accessed_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (userFilter !== "all") {
        query = query.eq("user_id", userFilter);
      }
      if (searchQuery.trim()) {
        query = query.or(`user_name.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      
      // Filter by reason in metadata (client-side since jsonb filtering is complex)
      let filteredData = data as AccessDenialLog[];
      if (reasonFilter !== "all") {
        filteredData = filteredData.filter(log => 
          log.metadata?.reason?.includes(reasonFilter)
        );
      }
      
      return { logs: filteredData, totalCount: count || 0 };
    },
  });

  // Fetch unique users for filter
  const { data: users = [] } = useQuery({
    queryKey: ["access-denial-logs-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_access_logs")
        .select("user_id, user_name")
        .eq("action", "access_denied")
        .limit(1000);
      
      if (error) throw error;
      
      const uniqueUsers = new Map<string, string>();
      data?.forEach((log) => {
        if (log.user_id && log.user_name) {
          uniqueUsers.set(log.user_id, log.user_name);
        }
      });
      
      return Array.from(uniqueUsers.entries()).map(([id, name]) => ({ id, name }));
    },
  });

  const logs = logsData?.logs || [];
  const totalCount = logsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Count high severity events
  const highSeverityCount = logs.filter(log => {
    const reason = log.metadata?.reason || "";
    return REASON_LABELS[reason]?.severity === "high";
  }).length;

  // Export to CSV
  const handleExport = async () => {
    let query = supabase
      .from("data_access_logs")
      .select("*")
      .eq("action", "access_denied")
      .gte("accessed_at", startDate.toISOString())
      .lte("accessed_at", endDate.toISOString())
      .order("accessed_at", { ascending: false })
      .limit(10000);

    if (userFilter !== "all") query = query.eq("user_id", userFilter);

    const { data } = await query;
    if (!data?.length) return;

    const headers = ["Date/Time", "User", "Attempted Route", "Reason", "Redirected To", "User Agent"];
    const rows = data.map((log: AccessDenialLog) => [
      format(new Date(log.accessed_at), "yyyy-MM-dd HH:mm:ss"),
      log.user_name,
      log.metadata?.attempted_route || "-",
      log.metadata?.reason || "-",
      log.metadata?.redirect_to || "-",
      log.user_agent || "-",
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-denial-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityBadge = (reason: string) => {
    const config = REASON_LABELS[reason];
    if (!config) return <Badge variant="outline">{reason}</Badge>;
    
    const colorClass = config.severity === "high" 
      ? "bg-destructive/10 text-destructive" 
      : config.severity === "medium" 
        ? "bg-warning/10 text-warning" 
        : "bg-muted text-muted-foreground";
    
    return (
      <Badge className={colorClass}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner for High Severity */}
      {highSeverityCount > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  {highSeverityCount} high-severity access denial{highSeverityCount !== 1 ? "s" : ""} detected
                </p>
                <p className="text-sm text-muted-foreground">
                  Review these events to ensure user roles are configured correctly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <span>Access Denial Logs</span>
            </div>
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
              <Label>Reason</Label>
              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  {Object.entries(REASON_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="User name..."
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
            <p className="text-xs text-muted-foreground">Total Denials</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{highSeverityCount}</div>
            <p className="text-xs text-muted-foreground">High Severity</p>
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
            <Button variant="outline" onClick={handleExport} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No access denials found for the selected filters.</p>
              <p className="text-sm">This is a good sign - users have appropriate access.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Attempted Route</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Redirected To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.accessed_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>{log.user_name || "Unknown"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.metadata?.attempted_route || "-"}
                        </TableCell>
                        <TableCell>
                          {getSeverityBadge(log.metadata?.reason || "unknown")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.metadata?.redirect_to || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
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
