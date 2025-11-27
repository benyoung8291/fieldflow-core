import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, addDays, addWeeks, addMonths, addYears, isBefore } from "date-fns";
import { Calendar } from "lucide-react";

interface FutureServiceOrdersTabProps {
  contractLineItems: any[];
}

export function FutureServiceOrdersTab({ contractLineItems }: FutureServiceOrdersTabProps) {
  // Generate future service orders based on contract line items
  const generateFutureOrders = () => {
    const futureOrders: any[] = [];
    const now = new Date();
    const maxFutureDays = 180; // Look 6 months ahead

    contractLineItems
      .filter(item => item.service_contracts?.status === 'active' && item.is_active)
      .forEach(item => {
        let nextDate = item.next_generation_date 
          ? parseISO(item.next_generation_date)
          : parseISO(item.first_generation_date);

        const endDate = item.service_contracts?.end_date 
          ? parseISO(item.service_contracts.end_date)
          : addDays(now, maxFutureDays);

        const maxDate = addDays(now, maxFutureDays);
        const cutoffDate = isBefore(endDate, maxDate) ? endDate : maxDate;

        // Generate dates based on recurrence frequency
        while (isBefore(nextDate, cutoffDate)) {
          if (!isBefore(nextDate, now)) {
            futureOrders.push({
              date: nextDate,
              contractNumber: item.service_contracts?.contract_number,
              contractTitle: item.service_contracts?.title,
              description: item.description,
              frequency: item.recurrence_frequency,
              estimatedHours: item.estimated_hours,
              amount: item.line_total,
              keyNumber: item.key_number,
            });
          }

          // Calculate next occurrence
          switch (item.recurrence_frequency) {
            case 'daily':
              nextDate = addDays(nextDate, 1);
              break;
            case 'weekly':
              nextDate = addWeeks(nextDate, 1);
              break;
            case 'biweekly':
              nextDate = addWeeks(nextDate, 2);
              break;
            case 'monthly':
              nextDate = addMonths(nextDate, 1);
              break;
            case 'quarterly':
              nextDate = addMonths(nextDate, 3);
              break;
            case 'biannually':
              nextDate = addMonths(nextDate, 6);
              break;
            case 'annually':
              nextDate = addYears(nextDate, 1);
              break;
            case 'once':
            default:
              nextDate = addYears(nextDate, 100); // Stop after one occurrence
              break;
          }
        }
      });

    return futureOrders.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const futureOrders = generateFutureOrders();

  const frequencyColors: Record<string, string> = {
    daily: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    weekly: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    biweekly: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    monthly: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    quarterly: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    biannually: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    annually: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  if (futureOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          No future service orders scheduled for this location
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Service orders will appear here based on active contract line items
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {futureOrders.length} upcoming service order{futureOrders.length !== 1 ? 's' : ''} 
          for the next 6 months
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scheduled Date</TableHead>
            <TableHead>Contract</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {futureOrders.map((order, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">
                {format(order.date, "PP")}
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{order.contractNumber}</div>
                  <div className="text-sm text-muted-foreground">{order.contractTitle}</div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div>{order.description}</div>
                  {order.keyNumber && (
                    <div className="text-xs text-muted-foreground">Key: {order.keyNumber}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline" 
                  className={frequencyColors[order.frequency] || "bg-muted"}
                >
                  {order.frequency}
                </Badge>
              </TableCell>
              <TableCell>{order.estimatedHours || '-'}h</TableCell>
              <TableCell className="text-right font-medium">
                ${order.amount.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
