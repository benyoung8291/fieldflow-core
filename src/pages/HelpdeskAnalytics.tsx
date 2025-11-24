import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { CalendarIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverviewMetrics } from "@/components/helpdesk/analytics/OverviewMetrics";
import { ResponseTimeChart } from "@/components/helpdesk/analytics/ResponseTimeChart";
import { TeamPerformance } from "@/components/helpdesk/analytics/TeamPerformance";
import { PipelineMetrics } from "@/components/helpdesk/analytics/PipelineMetrics";
import { CustomerMetrics } from "@/components/helpdesk/analytics/CustomerMetrics";
import { AtRiskTickets } from "@/components/helpdesk/analytics/AtRiskTickets";
import { DateRange } from "react-day-picker";
import DashboardLayout from "@/components/DashboardLayout";

export default function HelpdeskAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  return (
    <DashboardLayout disablePresence={true}>
      <div className="min-h-full bg-gradient-to-b from-background to-muted/20">
        {/* Header */}
        <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Help Desk Analytics</h1>
                <p className="text-muted-foreground mt-1">
                  Track performance metrics and insights
                </p>
              </div>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 py-8">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-background">
                Overview
              </TabsTrigger>
              <TabsTrigger value="team" className="data-[state=active]:bg-background">
                Team Performance
              </TabsTrigger>
              <TabsTrigger value="pipelines" className="data-[state=active]:bg-background">
                Pipelines
              </TabsTrigger>
              <TabsTrigger value="customers" className="data-[state=active]:bg-background">
                Customers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <OverviewMetrics dateRange={dateRange} />
              <AtRiskTickets />
              <ResponseTimeChart dateRange={dateRange} />
            </TabsContent>

            <TabsContent value="team" className="space-y-6">
              <TeamPerformance dateRange={dateRange} />
            </TabsContent>

            <TabsContent value="pipelines" className="space-y-6">
              <PipelineMetrics dateRange={dateRange} />
            </TabsContent>

            <TabsContent value="customers" className="space-y-6">
              <CustomerMetrics dateRange={dateRange} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
