import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRange } from "react-day-picker";
import { format, eachDayOfInterval, startOfDay } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { calculateBusinessHours } from "@/lib/businessDays";

interface ResponseTimeChartProps {
  dateRange?: DateRange;
}

export function ResponseTimeChart({ dateRange }: ResponseTimeChartProps) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["helpdesk-response-chart", dateRange],
    queryFn: async () => {
      const startDate = dateRange?.from || new Date();
      const endDate = dateRange?.to || new Date();

      const days = eachDayOfInterval({ start: startDate, end: endDate });

      const { data: tickets } = await supabase
        .from("helpdesk_tickets")
        .select("*")
        .gte("created_at", format(startDate, "yyyy-MM-dd"))
        .lte("created_at", format(endDate, "yyyy-MM-dd"));

      const { data: messages } = await supabase
        .from("helpdesk_messages")
        .select("*")
        .gte("created_at", format(startDate, "yyyy-MM-dd"))
        .lte("created_at", format(endDate, "yyyy-MM-dd"));

      return days.map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayTickets = tickets?.filter(t => 
          format(new Date(t.created_at), "yyyy-MM-dd") === dayStr
        ) || [];

        // Calculate response times for this day
        const responseTimes = dayTickets.map(ticket => {
          const ticketMessages = messages?.filter(m => m.ticket_id === ticket.id) || [];
          const firstCustomerMsg = ticketMessages.find(m => m.is_from_customer);
          const firstReply = ticketMessages.find(m => !m.is_from_customer);
          
          if (firstReply && firstCustomerMsg) {
            return calculateBusinessHours(
              new Date(firstCustomerMsg.created_at),
              new Date(firstReply.created_at)
            );
          }
          return null;
        }).filter(Boolean) as number[];

        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

        return {
          date: format(day, "MMM dd"),
          tickets: dayTickets.length,
          avgResponseTime: Math.round(avgResponseTime * 10) / 10,
        };
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="pt-6">
          <div className="h-[400px] bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Response Time Trend</CardTitle>
          <CardDescription>Average time to first reply (hours)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="avgResponseTime" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
                name="Avg Response Time"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Ticket Volume</CardTitle>
          <CardDescription>Number of tickets per day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="tickets" 
                fill="hsl(var(--primary))" 
                radius={[8, 8, 0, 0]}
                name="Tickets"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
