import { useState } from "react";
import { useLogListPageAccess } from "@/hooks/useLogDetailPageAccess";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, DollarSign, ArrowUpDown } from "lucide-react";
import { formatMelbourneTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/mobile/PullToRefreshIndicator";
import { usePagination } from "@/hooks/usePagination";
import { ModuleTutorial } from "@/components/onboarding/ModuleTutorial";
import { TUTORIAL_CONTENT } from "@/data/tutorialContent";
import { PermissionButton } from "@/components/permissions";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-info/10 text-info",
  checked_in: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

type SortField = "start_time" | "status" | "estimated_hours" | "current_cost";
type SortOrder = "asc" | "desc";

export default function Appointments() {
  const navigate = useNavigate();
  const { isMobile } = useViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("start_time");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const pagination = usePagination({ initialPageSize: 50 });

  // Log list page access for audit trail
  useLogListPageAccess('appointments');

  const { data: appointmentsResponse, isLoading, refetch } = useQuery({
    queryKey: ["all-appointments", searchQuery, statusFilter, pagination.currentPage, pagination.pageSize],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { from, to } = pagination.getRange();

      // Fetch appointments with service orders
      let query = supabase
        .from("appointments")
        .select(`
          *,
          service_orders (
            id,
            work_order_number,
            purchase_order_number
          )
        `, { count: 'exact' })
        .eq("tenant_id", profile.tenant_id)
        .order("start_time", { ascending: false });

      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        query = query.or(`title.ilike.%${searchLower}%`);
      }

      // Apply pagination after filters
      query = query.range(from, to);

      const { data: appointmentsData, error, count } = await query;
      if (error) throw error;

      // Fetch time logs and calculate costs
      const appointmentsWithCosts = await Promise.all(
        (appointmentsData || []).map(async (appointment: any) => {
          // Fetch time logs for this appointment
          const { data: timeLogs } = await supabase
            .from("time_logs")
            .select(`
              *,
              profiles (
                id,
                first_name,
                last_name,
                pay_rate_category_id,
                pay_rate_categories (
                  hourly_rate
                )
              )
            `)
            .eq("appointment_id", appointment.id);

          // Calculate current cost from time logs
          let currentCost = 0;
          if (timeLogs && timeLogs.length > 0) {
            currentCost = timeLogs.reduce((total, log: any) => {
              if (log.start_time && log.end_time) {
                const hours = (new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / (1000 * 60 * 60);
                const hourlyRate = log.profiles?.pay_rate_categories?.hourly_rate || 0;
                return total + (hours * Number(hourlyRate));
              }
              return total;
            }, 0);
          }

          // Calculate estimated hours
          const estimatedHours = appointment.start_time && appointment.end_time
            ? (new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / (1000 * 60 * 60)
            : 0;

          return {
            ...appointment,
            currentCost,
            estimatedHours,
          };
        })
      );

      return { appointments: appointmentsWithCosts, count: count || 0 };
    },
  });

  const appointments = appointmentsResponse?.appointments || [];
  const totalCount = appointmentsResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / pagination.pageSize);

  const { containerRef, isPulling, isRefreshing, pullDistance, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await refetch();
    },
  });

  // No need for client-side filtering since we're filtering in the database query

  // Sort appointments
  const sortedAppointments = [...appointments].sort((a: any, b: any) => {
    let aValue, bValue;

    switch (sortField) {
      case "start_time":
        aValue = new Date(a.start_time).getTime();
        bValue = new Date(b.start_time).getTime();
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
      case "estimated_hours":
        aValue = a.estimatedHours;
        bValue = b.estimatedHours;
        break;
      case "current_cost":
        aValue = a.currentCost;
        bValue = b.currentCost;
        break;
      default:
        return 0;
    }

    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <DashboardLayout>
      <ModuleTutorial 
        moduleName="appointments"
        defaultSteps={TUTORIAL_CONTENT.appointments.steps}
        title={TUTORIAL_CONTENT.appointments.title}
        description={TUTORIAL_CONTENT.appointments.description}
      />
      
      <div ref={containerRef} className="relative h-full overflow-y-auto">
        <PullToRefreshIndicator
          isPulling={isPulling}
          isRefreshing={isRefreshing}
          pullDistance={pullDistance}
          threshold={threshold}
        />
        <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">View and manage all appointments</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  placeholder="Search appointments, work orders..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    pagination.resetPage();
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="checked_in">Checked In</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading appointments...</p>
          </div>
        ) : sortedAppointments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No appointments found</p>
            </CardContent>
          </Card>
        ) : isMobile ? (
          <div className="space-y-3">
            {sortedAppointments.map((appointment: any) => (
              <MobileDocumentCard
                key={appointment.id}
                title={appointment.title}
                subtitle={appointment.service_orders?.work_order_number ? `WO: ${appointment.service_orders.work_order_number}` : undefined}
                status={appointment.status}
                statusColor={statusColors[appointment.status as keyof typeof statusColors].split(" ")[0]}
                metadata={[
                  { label: "Date", value: formatMelbourneTime(appointment.start_time, "MMM d, yyyy") },
                  { label: "Time", value: formatMelbourneTime(appointment.start_time, "h:mm a") },
                  { label: "Est. Hours", value: `${appointment.estimatedHours.toFixed(2)} hrs` },
                  { label: "Cost", value: `$${appointment.currentCost.toFixed(2)}` },
                ]}
                to={`/appointments/${appointment.id}`}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("status")}
                        className="flex items-center gap-1 -ml-3"
                      >
                        Status
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Service Order</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("start_time")}
                        className="flex items-center gap-1 -ml-3"
                      >
                        Date & Time
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("estimated_hours")}
                        className="flex items-center gap-1 -ml-3"
                      >
                        Est. Hours
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSort("current_cost")}
                        className="flex items-center gap-1 -ml-3"
                      >
                        Current Cost
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAppointments.map((appointment: any) => (
                    <TableRow key={appointment.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link 
                          to={`/appointments/${appointment.id}`}
                          className="block w-full"
                        >
                          {appointment.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/appointments/${appointment.id}`}
                          className="block w-full"
                        >
                          <Badge
                            variant="outline"
                            className={statusColors[appointment.status as keyof typeof statusColors]}
                          >
                            {appointment.status}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/appointments/${appointment.id}`}
                          className="block w-full"
                        >
                          {appointment.service_orders ? (
                            <div className="text-sm">
                              <div className="font-medium">
                                WO: {appointment.service_orders.work_order_number || "N/A"}
                              </div>
                              {appointment.service_orders.purchase_order_number && (
                                <div className="text-muted-foreground">
                                  PO: {appointment.service_orders.purchase_order_number}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No service order</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/appointments/${appointment.id}`}
                          className="block w-full"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatMelbourneTime(appointment.start_time, "MMM d, yyyy")}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              {formatMelbourneTime(appointment.start_time, "h:mm a")}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/appointments/${appointment.id}`}
                          className="block w-full"
                        >
                          <div className="text-sm font-medium">
                            {appointment.estimatedHours.toFixed(2)} hrs
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link 
                          to={`/appointments/${appointment.id}`}
                          className="block w-full"
                        >
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            {appointment.currentCost.toFixed(2)}
                          </div>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        
        {/* Pagination Controls */}
        {!isMobile && totalPages > 1 && (
          <Card className="mt-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {pagination.currentPage * pagination.pageSize + 1} - {Math.min((pagination.currentPage + 1) * pagination.pageSize, totalCount)} of {totalCount} appointments
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pagination.prevPage()}
                    disabled={pagination.currentPage === 0}
                  >
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.currentPage + 1} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pagination.nextPage()}
                    disabled={pagination.currentPage >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}
