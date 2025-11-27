import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Target, Clock, Users, FileText, Wrench, FileCheck, CalendarDays } from 'lucide-react';
import { formatDistanceToNow, format, subMonths, startOfMonth, endOfMonth, isFuture, isAfter, isBefore } from 'date-fns';

// Lazy load recharts components
const BarChart = lazy(() => import('recharts').then(m => ({ default: m.BarChart })));
const Bar = lazy(() => import('recharts').then(m => ({ default: m.Bar })));
const LineChart = lazy(() => import('recharts').then(m => ({ default: m.LineChart })));
const Line = lazy(() => import('recharts').then(m => ({ default: m.Line })));
const PieChart = lazy(() => import('recharts').then(m => ({ default: m.PieChart })));
const Pie = lazy(() => import('recharts').then(m => ({ default: m.Pie })));
const Cell = lazy(() => import('recharts').then(m => ({ default: m.Cell })));
const XAxis = lazy(() => import('recharts').then(m => ({ default: m.XAxis })));
const YAxis = lazy(() => import('recharts').then(m => ({ default: m.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(m => ({ default: m.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(m => ({ default: m.Tooltip })));
const Legend = lazy(() => import('recharts').then(m => ({ default: m.Legend })));
const ResponsiveContainer = lazy(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })));

const ChartFallback = () => <Skeleton className="h-[300px] w-full" />;

const COLORS = ['#0891B2', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6'];

export default function Analytics() {
  // Fetch quotes for analytics
  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(name),
          lead:leads(name, source),
          quote_owner:profiles!quote_owner(first_name, last_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch CRM statuses for probability calculations
  const { data: crmStatuses = [] } = useQuery({
    queryKey: ['crm-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_status_settings' as any)
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch service orders for analytics
  const { data: serviceOrders = [], error: soError, isLoading: soLoading } = useQuery({
    queryKey: ['service-orders-analytics'],
    queryFn: async () => {
      console.log('Fetching service orders for analytics...');
      const { data, error } = await supabase
        .from('service_orders')
        .select(`
          *,
          customer:customers(name),
          location:customer_locations(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Service orders fetch error:', error);
        throw error;
      }
      console.log('Service orders fetched:', data?.length, data);
      return data as any[];
    },
  });

  // Log service orders errors
  if (soError) {
    console.error('Service orders query error:', soError);
  }

  // Fetch service contracts for analytics
  const { data: serviceContracts = [], error: scError, isLoading: scLoading } = useQuery({
    queryKey: ['service-contracts-analytics'],
    queryFn: async () => {
      console.log('Fetching service contracts for analytics...');
      const { data, error } = await supabase
        .from('service_contracts')
        .select(`
          *,
          customer:customers(name),
          location:customer_locations(name),
          line_items:service_contract_line_items(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Service contracts fetch error:', error);
        throw error;
      }
      console.log('Service contracts fetched:', data?.length, data);
      return data as any[];
    },
  });

  // Log service contracts errors
  if (scError) {
    console.error('Service contracts query error:', scError);
  }

  // Calculate key metrics
  const totalQuotes = quotes.length;
  const wonQuotes = quotes.filter(q => q.crm_status === 'won').length;
  const lostQuotes = quotes.filter(q => q.crm_status === 'lost').length;
  const activeQuotes = quotes.filter(q => !['won', 'lost'].includes(q.crm_status)).length;
  const conversionRate = totalQuotes > 0 ? ((wonQuotes / totalQuotes) * 100).toFixed(1) : '0.0';
  
  const totalValue = quotes.reduce((sum, q) => sum + (q.total_amount || 0), 0);
  const wonValue = quotes.filter(q => q.crm_status === 'won').reduce((sum, q) => sum + (q.total_amount || 0), 0);
  const avgDealSize = totalQuotes > 0 ? totalValue / totalQuotes : 0;
  
  // Calculate weighted pipeline
  const weightedPipeline = quotes
    .filter(q => !['won', 'lost'].includes(q.crm_status))
    .reduce((sum, q) => {
      const status = crmStatuses.find(s => s.status === q.crm_status);
      const probability = status ? Number(status.probability_percentage) / 100 : 0;
      return sum + ((q.total_amount || 0) * probability);
    }, 0);

  // Average time to close (won quotes)
  const wonQuotesWithDates = quotes.filter(q => q.crm_status === 'won' && q.created_at && q.approved_at);
  const avgTimeToClose = wonQuotesWithDates.length > 0
    ? wonQuotesWithDates.reduce((sum, q) => {
        const created = new Date(q.created_at);
        const approved = new Date(q.approved_at);
        return sum + (approved.getTime() - created.getTime());
      }, 0) / wonQuotesWithDates.length / (1000 * 60 * 60 * 24) // Convert to days
    : 0;

  // Win/Loss by lead source
  const leadSourceData = quotes
    .filter(q => q.lead?.source && ['won', 'lost'].includes(q.crm_status))
    .reduce((acc: any, q) => {
      const source = q.lead.source;
      if (!acc[source]) {
        acc[source] = { source, won: 0, lost: 0 };
      }
      if (q.crm_status === 'won') acc[source].won++;
      else acc[source].lost++;
      return acc;
    }, {});

  const leadSourceChartData = Object.values(leadSourceData);

  // Monthly trend data (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    const monthQuotes = quotes.filter(q => {
      const created = new Date(q.created_at);
      return created >= monthStart && created <= monthEnd;
    });

    return {
      month: format(date, 'MMM'),
      quotes: monthQuotes.length,
      won: monthQuotes.filter(q => q.crm_status === 'won').length,
      value: monthQuotes.reduce((sum, q) => sum + (q.total_amount || 0), 0),
    };
  });

  // Quote status distribution
  const statusDistribution = crmStatuses.map(status => ({
    name: status.display_name,
    value: quotes.filter(q => q.crm_status === status.status).length,
    color: status.color,
  })).filter(s => s.value > 0);

  // Top performers
  const ownerPerformance = quotes
    .filter(q => q.quote_owner && q.crm_status === 'won')
    .reduce((acc: any, q) => {
      const ownerId = q.quote_owner;
      const ownerName = q.quote_owner 
        ? `${q.quote_owner.first_name || ''} ${q.quote_owner.last_name || ''}`.trim() || 'Unknown'
        : 'Unassigned';
      
      if (!acc[ownerId]) {
        acc[ownerId] = { owner: ownerName, count: 0, value: 0 };
      }
      acc[ownerId].count++;
      acc[ownerId].value += q.total_amount || 0;
      return acc;
    }, {});

  const topPerformers = Object.values(ownerPerformance)
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 5);

  // Service Order Analytics
  const completedOrders = serviceOrders.filter(so => so.status === 'completed');
  const inProgressOrders = serviceOrders.filter(so => ['scheduled', 'in_progress', 'dispatched'].includes(so.status));
  const futureOrders = serviceOrders.filter(so => 
    so.scheduled_start && isFuture(new Date(so.scheduled_start))
  );
  
  const totalOrderRevenue = completedOrders.reduce((sum, so) => sum + (Number(so.fixed_amount) || 0), 0);
  const wipOrderValue = inProgressOrders.reduce((sum, so) => sum + (Number(so.fixed_amount) || 0), 0);
  const futureOrderValue = futureOrders.reduce((sum, so) => sum + (Number(so.fixed_amount) || 0), 0);
  const avgOrderValue = completedOrders.length > 0 ? totalOrderRevenue / completedOrders.length : 0;

  // Service Contract Analytics
  const activeContracts = serviceContracts.filter(sc => sc.status === 'active');
  const expiredContracts = serviceContracts.filter(sc => sc.status === 'expired');
  const expiringContracts = activeContracts.filter(sc => {
    if (!sc.end_date) return false;
    const endDate = new Date(sc.end_date);
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);
    return endDate <= in90Days;
  });

  const totalContractValue = activeContracts.reduce((sum, sc) => sum + (Number(sc.total_contract_value) || 0), 0);
  const avgContractValue = activeContracts.length > 0 ? totalContractValue / activeContracts.length : 0;
  const monthlyRecurringRevenue = activeContracts.reduce((sum, sc) => {
    const lineItems = sc.line_items || [];
    return sum + lineItems
      .filter((li: any) => li.frequency === 'monthly')
      .reduce((liSum: number, li: any) => liSum + (Number(li.unit_price) * Number(li.quantity)), 0);
  }, 0);

  // Monthly service order trends
  const monthlyOrderData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    const monthOrders = serviceOrders.filter(so => {
      const created = new Date(so.created_at);
      return created >= monthStart && created <= monthEnd;
    });

    const completed = monthOrders.filter(so => so.status === 'completed');

    return {
      month: format(date, 'MMM'),
      total: monthOrders.length,
      completed: completed.length,
      revenue: completed.reduce((sum, so) => sum + (Number(so.fixed_amount) || 0), 0),
    };
  });

  // Order status distribution
  const orderStatusData = [
    { name: 'Completed', value: completedOrders.length },
    { name: 'In Progress', value: inProgressOrders.length },
    { name: 'Scheduled', value: futureOrders.length },
    { name: 'Other', value: serviceOrders.length - completedOrders.length - inProgressOrders.length - futureOrders.length },
  ].filter(s => s.value > 0);

  // Contract status distribution
  const contractStatusData = [
    { name: 'Active', value: activeContracts.length },
    { name: 'Expiring Soon', value: expiringContracts.length },
    { name: 'Expired', value: expiredContracts.length },
    { name: 'Other', value: serviceContracts.length - activeContracts.length - expiredContracts.length },
  ].filter(s => s.value > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">CRM Analytics</h1>
          <p className="text-muted-foreground">Track performance, conversions, and pipeline health</p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Weighted: ${weightedPipeline.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionRate}%</div>
              <p className="text-xs text-muted-foreground">
                {wonQuotes} won / {totalQuotes} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${avgDealSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <p className="text-xs text-muted-foreground">
                Total won: ${wonValue.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Time to Close</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgTimeToClose.toFixed(0)} days</div>
              <p className="text-xs text-muted-foreground">
                {activeQuotes} active quotes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="sources">Lead Sources</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="orders">Service Orders</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quote Volume Trends</CardTitle>
                <CardDescription>Monthly quote creation and win rates</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartFallback />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="quotes" stroke="#0891B2" name="Total Quotes" />
                      <Line type="monotone" dataKey="won" stroke="#10B981" name="Won" />
                    </LineChart>
                  </ResponsiveContainer>
                </Suspense>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Quote Value</CardTitle>
                <CardDescription>Total value of quotes created per month</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartFallback />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="value" fill="#0891B2" name="Quote Value" />
                    </BarChart>
                  </ResponsiveContainer>
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Win/Loss by Lead Source</CardTitle>
                <CardDescription>Conversion performance by lead origin</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartFallback />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={leadSourceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="won" fill="#10B981" name="Won" />
                      <Bar dataKey="lost" fill="#EF4444" name="Lost" />
                    </BarChart>
                  </ResponsiveContainer>
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Distribution</CardTitle>
                <CardDescription>Quotes by CRM status</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartFallback />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Suspense>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {crmStatuses.map(status => {
                const statusQuotes = quotes.filter(q => q.crm_status === status.status);
                const statusValue = statusQuotes.reduce((sum, q) => sum + (q.total_amount || 0), 0);
                const probability = Number(status.probability_percentage) / 100;
                const weightedValue = statusValue * probability;

                return (
                  <Card key={status.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">{status.display_name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${statusValue.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">
                        {statusQuotes.length} quotes • {status.probability_percentage}% probability
                      </p>
                      <p className="text-xs font-semibold mt-1" style={{ color: status.color || '#6B7280' }}>
                        Weighted: ${weightedValue.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>Quote owners with highest won value</CardDescription>
              </CardHeader>
              <CardContent>
                {topPerformers.length > 0 ? (
                  <Suspense fallback={<ChartFallback />}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topPerformers} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="owner" type="category" width={100} />
                        <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                        <Bar dataKey="value" fill="#0891B2" name="Total Value" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Suspense>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-2" />
                    <p>No performance data available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Active Quotes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeQuotes}</div>
                  <p className="text-xs text-muted-foreground">
                    In progress
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Won This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{monthlyData[5]?.won || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    ${(monthlyData[5]?.value || 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{conversionRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    {wonQuotes}W / {lostQuotes}L
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            {/* Service Order Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Historical Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalOrderRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {completedOrders.length} completed orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Work in Progress</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${wipOrderValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {inProgressOrders.length} active orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Future Scheduled</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${futureOrderValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {futureOrders.length} scheduled orders
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground">
                    Completed orders
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Service Order Trends</CardTitle>
                  <CardDescription>Order volume and completion rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyOrderData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#0891B2" name="Total Orders" />
                      <Line type="monotone" dataKey="completed" stroke="#10B981" name="Completed" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue</CardTitle>
                  <CardDescription>Completed order revenue by month</CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<ChartFallback />}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyOrderData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                        <Legend />
                        <Bar dataKey="revenue" fill="#10B981" name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Suspense>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Order Status Distribution</CardTitle>
                <CardDescription>Current state of all service orders</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartFallback />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {orderStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="space-y-4">
            {/* Contract Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalContractValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeContracts.length} active contracts
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${monthlyRecurringRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    From active contracts
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
                  <FileCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{expiringContracts.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Within 90 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Contract Value</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${avgContractValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground">
                    Active contracts
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Contract Status Distribution</CardTitle>
                  <CardDescription>Overview of all service contracts</CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<ChartFallback />}>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={contractStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {contractStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Suspense>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Expiring Contracts</CardTitle>
                  <CardDescription>Action required within 90 days</CardDescription>
                </CardHeader>
                <CardContent>
                  {expiringContracts.length > 0 ? (
                    <div className="space-y-2">
                      {expiringContracts.slice(0, 5).map((contract: any) => (
                        <div key={contract.id} className="flex justify-between items-center p-2 border rounded">
                          <div>
                            <p className="font-medium text-sm">{contract.customer?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Expires: {format(new Date(contract.end_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${Number(contract.total_contract_value).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                      {expiringContracts.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{expiringContracts.length - 5} more expiring
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileCheck className="mx-auto h-12 w-12 mb-2" />
                      <p>No contracts expiring soon</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Forecast</CardTitle>
                <CardDescription>Projected revenue from active contracts and scheduled orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded">
                    <p className="text-sm text-muted-foreground">Next 30 Days</p>
                    <p className="text-2xl font-bold">${(monthlyRecurringRevenue).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">Monthly recurring</p>
                  </div>
                  <div className="p-4 border rounded">
                    <p className="text-sm text-muted-foreground">Next 90 Days</p>
                    <p className="text-2xl font-bold">${(monthlyRecurringRevenue * 3).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">Quarterly projection</p>
                  </div>
                  <div className="p-4 border rounded">
                    <p className="text-sm text-muted-foreground">Future Scheduled</p>
                    <p className="text-2xl font-bold">${futureOrderValue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">{futureOrders.length} orders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
