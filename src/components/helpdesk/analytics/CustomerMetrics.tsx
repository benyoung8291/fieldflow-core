import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

interface CustomerMetricsProps {
  dateRange?: DateRange;
}

export function CustomerMetrics({ dateRange }: CustomerMetricsProps) {
  const { data: customerData, isLoading } = useQuery({
    queryKey: ["helpdesk-customer-metrics", dateRange],
    queryFn: async () => {
      const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
      const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null;

      let ticketsQuery = supabase
        .from("helpdesk_tickets")
        .select("*, customer:customers(id, name)");

      if (startDate) ticketsQuery = ticketsQuery.gte("created_at", startDate);
      if (endDate) ticketsQuery = ticketsQuery.lte("created_at", endDate);

      const { data: tickets } = await ticketsQuery;

      const customerMap = new Map();

      tickets?.forEach(ticket => {
        const customerId = ticket.customer?.id || "unknown";
        const customerName = ticket.customer?.name || ticket.external_email || "Unknown";

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            id: customerId,
            name: customerName,
            ticketCount: 0,
            archivedCount: 0,
          });
        }

        const data = customerMap.get(customerId);
        data.ticketCount++;
        if (ticket.is_archived) data.archivedCount++;
      });

      return Array.from(customerMap.values())
        .map(customer => ({
          ...customer,
          resolutionRate: customer.ticketCount > 0
            ? Math.round((customer.archivedCount / customer.ticketCount) * 100)
            : 0,
        }))
        .sort((a, b) => b.ticketCount - a.ticketCount)
        .slice(0, 20); // Top 20 customers
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Top Customers by Ticket Volume</CardTitle>
          <CardDescription>Customers with the most support requests</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {customerData?.map((customer, index) => (
          <Card key={customer.id} className="hover:shadow-md transition-all hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Building2 className="h-6 w-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      #{index + 1}
                    </Badge>
                    <h3 className="font-semibold truncate">{customer.name}</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Tickets</p>
                      <p className="text-lg font-semibold">{customer.ticketCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Resolved</p>
                      <p className="text-lg font-semibold">{customer.archivedCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rate</p>
                      <p className="text-lg font-semibold">{customer.resolutionRate}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
