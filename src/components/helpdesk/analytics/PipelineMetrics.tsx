import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface PipelineMetricsProps {
  dateRange?: DateRange;
}

export function PipelineMetrics({ dateRange }: PipelineMetricsProps) {
  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ["helpdesk-pipeline-metrics", dateRange],
    queryFn: async () => {
      const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
      const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null;

      // Get all pipelines first to ensure we show all of them
      const { data: allPipelines } = await supabase
        .from("helpdesk_pipelines")
        .select("id, name, color")
        .eq("tenant_id", (await supabase.auth.getUser()).data.user?.user_metadata?.tenant_id);

      let ticketsQuery = supabase
        .from("helpdesk_tickets")
        .select("*, pipeline:helpdesk_pipelines(id, name, color)");

      if (startDate) ticketsQuery = ticketsQuery.gte("created_at", startDate);
      if (endDate) ticketsQuery = ticketsQuery.lte("created_at", endDate);

      const { data: tickets } = await ticketsQuery;

      // Initialize map with all pipelines to ensure they all show
      const pipelineMap = new Map();
      
      allPipelines?.forEach(pipeline => {
        pipelineMap.set(pipeline.id, {
          id: pipeline.id,
          name: pipeline.name,
          color: pipeline.color,
          count: 0,
          archived: 0,
        });
      });

      tickets?.forEach(ticket => {
        if (!ticket.pipeline) return;

        const pipelineId = ticket.pipeline.id;
        if (!pipelineMap.has(pipelineId)) {
          pipelineMap.set(pipelineId, {
            id: pipelineId,
            name: ticket.pipeline.name,
            color: ticket.pipeline.color,
            count: 0,
            archived: 0,
          });
        }

        const data = pipelineMap.get(pipelineId);
        data.count++;
        if (ticket.is_archived) data.archived++;
      });

      return Array.from(pipelineMap.values()).map(pipeline => ({
        ...pipeline,
        value: pipeline.count,
        resolutionRate: pipeline.count > 0 
          ? Math.round((pipeline.archived / pipeline.count) * 100)
          : 0,
      }));
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
    <div className="grid gap-6">
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Ticket Distribution by Pipeline</CardTitle>
          <CardDescription>View tickets across different pipelines</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pipelineData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pipelineData?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pipelineData?.map((pipeline) => (
          <Card key={pipeline.id} className="hover:shadow-md transition-all hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: pipeline.color }}
                />
                <h3 className="font-semibold truncate">{pipeline.name}</h3>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Tickets</span>
                  <span className="font-semibold">{pipeline.count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Resolved</span>
                  <span className="font-semibold">{pipeline.archived}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Resolution Rate</span>
                  <span className="font-semibold">{pipeline.resolutionRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
