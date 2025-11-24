import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TeamPerformanceProps {
  dateRange?: DateRange;
}

export function TeamPerformance({ dateRange }: TeamPerformanceProps) {
  const { data: teamData, isLoading } = useQuery({
    queryKey: ["helpdesk-team-performance", dateRange],
    queryFn: async () => {
      const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
      const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null;

      let ticketsQuery = supabase
        .from("helpdesk_tickets")
        .select("*, assigned_user:profiles!helpdesk_tickets_assigned_to_fkey(id, first_name, last_name)");

      if (startDate) ticketsQuery = ticketsQuery.gte("created_at", startDate);
      if (endDate) ticketsQuery = ticketsQuery.lte("created_at", endDate);

      const { data: tickets } = await ticketsQuery;

      const { data: messages } = await supabase
        .from("helpdesk_messages")
        .select("*");

      // Group by user
      const userMap = new Map();

      tickets?.forEach(ticket => {
        if (!ticket.assigned_user) return;

        const userId = ticket.assigned_user.id;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            id: userId,
            name: `${ticket.assigned_user.first_name} ${ticket.assigned_user.last_name}`,
            initials: `${ticket.assigned_user.first_name[0]}${ticket.assigned_user.last_name[0]}`,
            ticketsAssigned: 0,
            ticketsArchived: 0,
            responseTimes: [],
          });
        }

        const userData = userMap.get(userId);
        userData.ticketsAssigned++;
        if (ticket.is_archived) userData.ticketsArchived++;

        // Calculate response time
        const ticketMessages = messages?.filter(m => m.ticket_id === ticket.id && !m.is_from_customer) || [];
        const firstReply = ticketMessages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )[0];

        if (firstReply) {
          const responseTime = (new Date(firstReply.created_at).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
          userData.responseTimes.push(responseTime);
        }
      });

      return Array.from(userMap.values()).map(user => ({
        ...user,
        avgResponseTime: user.responseTimes.length > 0
          ? Math.round((user.responseTimes.reduce((a: number, b: number) => a + b, 0) / user.responseTimes.length) * 10) / 10
          : 0,
        resolutionRate: user.ticketsAssigned > 0
          ? Math.round((user.ticketsArchived / user.ticketsAssigned) * 100)
          : 0,
      })).sort((a, b) => b.ticketsAssigned - a.ticketsAssigned);
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Card className="animate-pulse">
          <CardContent className="pt-6">
            <div className="h-[300px] bg-muted rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Team Performance Overview</CardTitle>
          <CardDescription>Tickets handled by team members</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
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
              <Bar dataKey="ticketsAssigned" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Assigned" />
              <Bar dataKey="ticketsArchived" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} name="Resolved" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamData?.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-all hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.ticketsAssigned} tickets
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Response</span>
                  <Badge variant="secondary">{user.avgResponseTime}h</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Resolution Rate</span>
                  <Badge variant="secondary">{user.resolutionRate}%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Resolved</span>
                  <Badge variant="secondary">{user.ticketsArchived}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
