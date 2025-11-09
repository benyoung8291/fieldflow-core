import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, Target, Clock, Users, FileText } from 'lucide-react';
import { formatDistanceToNow, format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

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
          </TabsList>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quote Volume Trends</CardTitle>
                <CardDescription>Monthly quote creation and win rates</CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Quote Value</CardTitle>
                <CardDescription>Total value of quotes created per month</CardDescription>
              </CardHeader>
              <CardContent>
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
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topPerformers} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="owner" type="category" width={100} />
                      <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                      <Bar dataKey="value" fill="#0891B2" name="Total Value" />
                    </BarChart>
                  </ResponsiveContainer>
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
