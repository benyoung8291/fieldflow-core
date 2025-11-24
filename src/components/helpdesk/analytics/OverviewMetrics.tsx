import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MessageSquare, CheckCircle, TrendingUp, TrendingDown, Users } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { calculateBusinessHours } from "@/lib/businessDays";

interface OverviewMetricsProps {
  dateRange?: DateRange;
}

export function OverviewMetrics({ dateRange }: OverviewMetricsProps) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["helpdesk-overview-metrics", dateRange],
    queryFn: async () => {
      const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
      const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null;

      let ticketsQuery = supabase
        .from("helpdesk_tickets")
        .select("*");

      if (startDate) ticketsQuery = ticketsQuery.gte("created_at", startDate);
      if (endDate) ticketsQuery = ticketsQuery.lte("created_at", endDate);

      const { data: tickets, error } = await ticketsQuery;
      if (error) throw error;

      // Calculate metrics
      const totalTickets = tickets?.length || 0;
      const assignedTickets = tickets?.filter(t => t.assigned_to)?.length || 0;
      const archivedTickets = tickets?.filter(t => t.is_archived)?.length || 0;
      const unassignedTickets = totalTickets - assignedTickets;

      // Time to assign (first assignment)
      const assignmentTimes = tickets
        ?.filter(t => t.assigned_to && t.created_at)
        .map(t => {
          const created = new Date(t.created_at);
          const lastMessage = new Date(t.last_message_at || t.created_at);
          return calculateBusinessHours(created, lastMessage);
        }) || [];

      const avgTimeToAssign = assignmentTimes.length > 0
        ? assignmentTimes.reduce((a, b) => a + b, 0) / assignmentTimes.length
        : 0;

      // Time to first reply
      const { data: messages } = await supabase
        .from("helpdesk_messages")
        .select("ticket_id, created_at, is_from_customer")
        .order("created_at", { ascending: true });

      const firstReplyTimes = tickets?.map(ticket => {
        const ticketMessages = messages?.filter(m => m.ticket_id === ticket.id) || [];
        const firstCustomerMsg = ticketMessages.find(m => m.is_from_customer);
        const firstReply = ticketMessages.find(m => !m.is_from_customer && m.created_at > (firstCustomerMsg?.created_at || ticket.created_at));
        
        if (firstReply && firstCustomerMsg) {
          return calculateBusinessHours(
            new Date(firstCustomerMsg.created_at),
            new Date(firstReply.created_at)
          );
        }
        return null;
      }).filter(Boolean) as number[];

      const avgTimeToReply = firstReplyTimes.length > 0
        ? firstReplyTimes.reduce((a, b) => a + b, 0) / firstReplyTimes.length
        : 0;

      // Time to archive
      const archiveTimes = tickets
        ?.filter(t => t.is_archived && t.created_at)
        .map(t => {
          const created = new Date(t.created_at);
          const archived = new Date(t.updated_at);
          return calculateBusinessHours(created, archived);
        }) || [];

      const avgTimeToArchive = archiveTimes.length > 0
        ? archiveTimes.reduce((a, b) => a + b, 0) / archiveTimes.length
        : 0;

      return {
        totalTickets,
        unassignedTickets,
        archivedTickets,
        avgTimeToAssign: Math.round(avgTimeToAssign * 10) / 10,
        avgTimeToReply: Math.round(avgTimeToReply * 10) / 10,
        avgTimeToArchive: Math.round(avgTimeToArchive * 10) / 10,
        assignmentRate: totalTickets > 0 ? Math.round((assignedTickets / totalTickets) * 100) : 0,
      };
    },
  });

  const metricCards = [
    {
      title: "Total Tickets",
      value: metrics?.totalTickets || 0,
      icon: MessageSquare,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      trend: null,
    },
    {
      title: "Avg. Time to Assign",
      value: `${metrics?.avgTimeToAssign || 0}h`,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      trend: null,
      description: "From ticket creation to assignment"
    },
    {
      title: "Avg. Time to First Reply",
      value: `${metrics?.avgTimeToReply || 0}h`,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
      trend: null,
      description: "From customer message to reply"
    },
    {
      title: "Avg. Time to Archive",
      value: `${metrics?.avgTimeToArchive || 0}h`,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      trend: null,
      description: "From creation to resolution"
    },
    {
      title: "Unassigned Tickets",
      value: metrics?.unassignedTickets || 0,
      icon: TrendingUp,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/30",
      trend: null,
      description: "Tickets awaiting assignment"
    },
    {
      title: "Assignment Rate",
      value: `${metrics?.assignmentRate || 0}%`,
      icon: TrendingUp,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
      trend: null,
      description: "Percentage of assigned tickets"
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-24 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {metricCards.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card 
            key={index}
            className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1 border-muted/50"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className={cn("p-2 rounded-lg", metric.bgColor)}>
                <Icon className={cn("h-4 w-4", metric.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{metric.value}</div>
              {metric.description && (
                <p className="text-xs text-muted-foreground mt-2">
                  {metric.description}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
