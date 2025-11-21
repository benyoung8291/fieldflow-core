import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";
import { useViewMode } from "@/contexts/ViewModeContext";
import { cn, formatCurrency, getMelbourneNow, toMelbourneTime } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, FileText, TrendingUp, RefreshCw, Plus } from "lucide-react";
import { format, addMonths, parseISO, addWeeks } from "date-fns";
import { useState } from "react";
import RenewContractDialog from "@/components/quotes/RenewContractDialog";
import ServiceContractDialog from "@/components/contracts/ServiceContractDialog";
import ImportContractDialog from "@/components/contracts/ImportContractDialog";
import GenerateServiceOrdersDialog from "@/components/contracts/GenerateServiceOrdersDialog";
import DashboardLayout from "@/components/DashboardLayout";
import { FileSpreadsheet } from "lucide-react";

export default function ServiceContracts() {
  const navigate = useNavigate();
  const { isMobile } = useViewMode();
  const queryClient = useQueryClient();
  const [renewingContract, setRenewingContract] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["service-contracts-dashboard"],
    queryFn: async () => {
    const { data, error } = await supabase
        .from("service_contracts" as any)
        .select(`
          *,
          customers (name),
          service_contract_line_items (*)
        `)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculate upcoming generations for next 12 months
  const calculateUpcomingGenerations = () => {
    if (!contracts) return [];
    
    const generations: any[] = [];
    const now = getMelbourneNow();
    const endDate = addMonths(now, 12);

    contracts.forEach((contract: any) => {
      if (contract.status !== "active") return;

      contract.service_contract_line_items?.forEach((item: any) => {
        if (!item.is_active) return;
        
        const startDate = item.next_generation_date || item.first_generation_date;
        if (!startDate) return;

        let currentDate = toMelbourneTime(startDate);
        
        while (currentDate <= endDate) {
          if (currentDate >= now) {
            generations.push({
              date: currentDate,
              contractId: contract.id,
              contractNumber: contract.contract_number,
              customerName: contract.customers?.name,
              itemDescription: item.description,
              amount: item.line_total,
              frequency: item.recurrence_frequency,
            });
          }

          // Calculate next date based on frequency
          switch (item.recurrence_frequency) {
            case "weekly":
              currentDate = addWeeks(currentDate, 1);
              break;
            case "fortnightly":
              currentDate = addWeeks(currentDate, 2);
              break;
            case "monthly":
              currentDate = addMonths(currentDate, 1);
              break;
            case "quarterly":
              currentDate = addMonths(currentDate, 3);
              break;
            case "yearly":
              currentDate = addMonths(currentDate, 12);
              break;
            default:
              currentDate = addMonths(currentDate, 100); // Stop loop for one_time
          }

          // Check if contract has ended
          if (contract.end_date && currentDate > toMelbourneTime(contract.end_date)) {
            break;
          }
        }
      });
    });

    return generations.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // Calculate revenue by month
  const calculateMonthlyRevenue = () => {
    const generations = calculateUpcomingGenerations();
    const monthlyRevenue: { [key: string]: number } = {};

    generations.forEach((gen) => {
      const monthKey = format(gen.date, "yyyy-MM");
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + parseFloat(gen.amount);
    });

    return Object.entries(monthlyRevenue)
      .map(([month, revenue]) => ({ month, revenue }))
      .slice(0, 12);
  };

  const activeContracts = contracts?.filter((c: any) => c.status === "active") || [];
  const upcomingGenerations = calculateUpcomingGenerations().slice(0, 20);
  const monthlyRevenue = calculateMonthlyRevenue();
  
  // Calculate total annualized value from line items using frequency multipliers
  const totalContractValue = activeContracts.reduce((sum: number, c: any) => {
    const contractValue = (c.service_contract_line_items || []).reduce(
      (itemSum: number, item: any) => {
        const frequencyMultiplier = {
          'daily': 365,
          'weekly': 52,
          'bi_weekly': 26,
          'monthly': 12,
          'quarterly': 4,
          'semi_annually': 2,
          'annually': 1
        }[item.recurrence_frequency] || 1;
        
        return itemSum + ((item.quantity || 0) * (item.unit_price || 0) * frequencyMultiplier);
      },
      0
    );
    return sum + contractValue;
  }, 0);

  const upcomingRenewals = contracts?.filter((c: any) => {
    if (!c.end_date || c.status !== "active") return false;
    const endDate = parseISO(c.end_date);
    const threeMonthsFromNow = addMonths(new Date(), 3);
    return endDate <= threeMonthsFromNow && endDate >= new Date();
  }) || [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Service Contracts</h1>
            <p className="text-muted-foreground">Manage active contracts and forecast revenue</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsGenerateDialogOpen(true)} 
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Generate Orders
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsImportDialogOpen(true)} 
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Import from Spreadsheet
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Contract
            </Button>
          </div>
        </div>

      {!isMobile && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeContracts.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalContractValue)}</div>
              <p className="text-xs text-muted-foreground">Ex-GST</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Generations</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingGenerations.length}</div>
              <p className="text-xs text-muted-foreground">Next 12 months</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Renewal Alerts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingRenewals.length}</div>
              <p className="text-xs text-muted-foreground">Within 3 months</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="contracts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contracts">Active Contracts</TabsTrigger>
          <TabsTrigger value="generations">Upcoming Generations</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Forecast</TabsTrigger>
          <TabsTrigger value="renewals">Renewal Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="space-y-4">
          {isMobile ? (
            <div className="space-y-3">
              {activeContracts.map((contract: any) => (
                <MobileDocumentCard
                  key={contract.id}
                  title={contract.contract_number}
                  subtitle={contract.customers?.name}
                  status={contract.status}
                  metadata={[
                    { label: "Start Date", value: format(parseISO(contract.start_date), "PP") },
                    { label: "End Date", value: contract.end_date ? format(parseISO(contract.end_date), "PP") : "Ongoing" },
                    { 
                      label: "Value", 
                      value: `$${((contract.service_contract_line_items || []).reduce(
                        (sum: number, item: any) => sum + parseFloat(item.line_total || 0), 0
                      )).toFixed(2)}` 
                    },
                  ]}
                  onClick={() => navigate(`/service-contracts/${contract.id}`)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Active Contracts</CardTitle>
                <CardDescription>All currently active service contracts</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Next Generation</TableHead>
                    <TableHead>12-Month Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeContracts.map((contract: any) => {
                    // Calculate next future generation date
                    const advanceDate = (date: Date, freq: string) => {
                      const newDate = new Date(date);
                      switch(freq) {
                        case "daily":
                          newDate.setDate(newDate.getDate() + 1);
                          break;
                        case "weekly":
                          newDate.setDate(newDate.getDate() + 7);
                          break;
                        case "bi_weekly":
                          newDate.setDate(newDate.getDate() + 14);
                          break;
                        case "monthly":
                          newDate.setMonth(newDate.getMonth() + 1);
                          break;
                        case "quarterly":
                          newDate.setMonth(newDate.getMonth() + 3);
                          break;
                        case "semi_annually":
                          newDate.setMonth(newDate.getMonth() + 6);
                          break;
                        case "annually":
                          newDate.setFullYear(newDate.getFullYear() + 1);
                          break;
                        default:
                          newDate.setMonth(newDate.getMonth() + 1);
                      }
                      return newDate;
                    };

                    const today = getMelbourneNow();
                    today.setHours(0, 0, 0, 0);
                    
                    const nextGenDates = (contract.service_contract_line_items || [])
                      .filter((item: any) => item.is_active && (item.next_generation_date || item.first_generation_date))
                      .map((item: any) => {
                        let currentDate = toMelbourneTime(item.next_generation_date || item.first_generation_date);
                        currentDate.setHours(0, 0, 0, 0);
                        
                        // Fast-forward to first occurrence after today
                        while (currentDate <= today) {
                          currentDate = advanceDate(currentDate, item.recurrence_frequency);
                        }
                        
                        return currentDate;
                      });
                    
                    const nextGenDate = nextGenDates.length > 0 ? new Date(Math.min(...nextGenDates.map(d => d.getTime()))) : null;

                    // Calculate annualized contract value using frequency multipliers
                    const annualizedValue = (contract.service_contract_line_items || []).reduce((sum: number, item: any) => {
                      const frequencyMultiplier = {
                        'daily': 365,
                        'weekly': 52,
                        'bi_weekly': 26,
                        'monthly': 12,
                        'quarterly': 4,
                        'semi_annually': 2,
                        'annually': 1
                      }[item.recurrence_frequency] || 1;
                      
                      return sum + ((item.quantity || 0) * (item.unit_price || 0) * frequencyMultiplier);
                    }, 0);

                    return (
                      <TableRow 
                        key={contract.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/service-contracts/${contract.id}`)}
                      >
                        <TableCell className="font-medium">{contract.contract_number}</TableCell>
                        <TableCell>{contract.customers?.name}</TableCell>
                        <TableCell>{format(parseISO(contract.start_date), "PP")}</TableCell>
                        <TableCell>{contract.end_date ? format(parseISO(contract.end_date), "PP") : "Ongoing"}</TableCell>
                        <TableCell>{nextGenDate ? format(nextGenDate, "PP") : "N/A"}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(annualizedValue)}</TableCell>
                        <TableCell>
                          <Badge variant="default">{contract.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="generations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Service Order Generations</CardTitle>
              <CardDescription>Scheduled service orders for the next 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Generation Date</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingGenerations.map((gen: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{format(gen.date, "PP")}</TableCell>
                      <TableCell>{gen.contractNumber}</TableCell>
                      <TableCell>{gen.customerName}</TableCell>
                      <TableCell>{gen.itemDescription}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{gen.frequency}</Badge>
                      </TableCell>
                      <TableCell>${parseFloat(gen.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Forecast (Ex-GST)</CardTitle>
              <CardDescription>Expected revenue from service order generations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Projected Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyRevenue.map((item) => (
                    <TableRow key={item.month}>
                      <TableCell className="font-medium">
                        {format(parseISO(item.month + "-01"), "MMMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right text-lg font-semibold">
                        ${item.revenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-bold">Total (12 Months)</TableCell>
                    <TableCell className="text-right text-lg font-bold">
                      ${monthlyRevenue.reduce((sum, item) => sum + item.revenue, 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renewals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Renewal Alerts</CardTitle>
              <CardDescription>Contracts ending within the next 3 months</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingRenewals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No upcoming renewals</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Days Until Renewal</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingRenewals.map((contract: any) => {
                      const endDate = parseISO(contract.end_date);
                      const daysUntil = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">{contract.contract_number}</TableCell>
                          <TableCell>{contract.customers?.name}</TableCell>
                          <TableCell>{format(endDate, "PP")}</TableCell>
                          <TableCell>${parseFloat(contract.total_contract_value).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={daysUntil <= 30 ? "destructive" : "secondary"}>
                              {daysUntil} days
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenewingContract(contract);
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Renew
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

        {renewingContract && (
          <RenewContractDialog
            open={!!renewingContract}
            onOpenChange={(open) => !open && setRenewingContract(null)}
            contract={renewingContract}
          />
        )}

        <ServiceContractDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />

        <ImportContractDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["service-contracts-dashboard"] });
          }}
        />

        <GenerateServiceOrdersDialog
          open={isGenerateDialogOpen}
          onOpenChange={setIsGenerateDialogOpen}
        />
        
        {/* Pagination info for contracts */}
        {contracts && contracts.length > 50 && (
          <div className="text-center text-sm text-muted-foreground mt-4">Showing first 100 contracts</div>
        )}
      </div>
    </DashboardLayout>
  );
}
