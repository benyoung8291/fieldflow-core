import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Map, Users, Calendar, ListTodo, Clock, CheckCircle, AlertCircle, LogOut, User } from 'lucide-react';
import { toast } from 'sonner';

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    activeWorkers: 0,
    todayAppointments: 0,
    pendingServiceOrders: 0,
    completedToday: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/worker/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      setUser(profile);

      // Get active workers (currently clocked in)
      const { data: activeLogs } = await supabase
        .from('time_logs')
        .select('worker_id', { count: 'exact', head: true })
        .is('clock_out_time', null);

      // Get today's appointments
      const today = new Date().toISOString().split('T')[0];
      const { data: todayApts } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('start_time', today)
        .lt('start_time', `${today}T23:59:59`);

      // Get pending service orders
      const { data: pendingSOs } = await supabase
        .from('service_orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['draft', 'scheduled']);

      // Get completed appointments today
      const { data: completedApts } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('check_out_time', today);

      setStats({
        activeWorkers: activeLogs?.length || 0,
        todayAppointments: todayApts?.length || 0,
        pendingServiceOrders: pendingSOs?.length || 0,
        completedToday: completedApts?.length || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/worker/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between max-w-screen-lg mx-auto">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium opacity-90">Supervisor</p>
                <h1 className="text-base font-bold">{user?.first_name} {user?.last_name}</h1>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/20"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-border/50 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-success/10 rounded-xl border border-success/20">
                  <Users className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats.activeWorkers}</p>
                  <p className="text-xs text-muted-foreground font-medium">Active Workers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-info/10 rounded-xl border border-info/20">
                  <Calendar className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats.todayAppointments}</p>
                  <p className="text-xs text-muted-foreground font-medium">Today's Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-warning/10 rounded-xl border border-warning/20">
                  <AlertCircle className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats.pendingServiceOrders}</p>
                  <p className="text-xs text-muted-foreground font-medium">Pending Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-success/10 rounded-xl border border-success/20">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{stats.completedToday}</p>
                  <p className="text-xs text-muted-foreground font-medium">Completed Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Management Tools</CardTitle>
            <CardDescription>Monitor and manage field operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              size="lg"
              onClick={() => navigate('/worker/supervisor/map')}
              className="w-full h-auto py-5 flex items-center justify-start gap-4 hover:shadow-lg transition-all duration-200"
            >
              <div className="p-2 bg-primary-foreground/20 rounded-lg">
                <Map className="h-7 w-7" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-base">Worker Locations</p>
                <p className="text-xs opacity-90 font-normal">Real-time GPS tracking</p>
              </div>
              {stats.activeWorkers > 0 && (
                <Badge variant="secondary" className="ml-auto px-3 py-1">
                  {stats.activeWorkers} active
                </Badge>
              )}
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/worker/supervisor/appointments')}
              className="w-full h-auto py-5 flex items-center justify-start gap-4 hover:shadow-md hover:bg-muted/50 transition-all duration-200 border-border/50"
            >
              <div className="p-2 bg-info/10 rounded-lg">
                <Calendar className="h-7 w-7 text-info" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-base">Appointments</p>
                <p className="text-xs text-muted-foreground">Manage schedules</p>
              </div>
              {stats.todayAppointments > 0 && (
                <Badge variant="secondary" className="ml-auto px-3 py-1">
                  {stats.todayAppointments} today
                </Badge>
              )}
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/worker/supervisor/service-orders')}
              className="w-full h-auto py-5 flex items-center justify-start gap-4 hover:shadow-md hover:bg-muted/50 transition-all duration-200 border-border/50"
            >
              <div className="p-2 bg-warning/10 rounded-lg">
                <ListTodo className="h-7 w-7 text-warning" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-base">Service Orders</p>
                <p className="text-xs text-muted-foreground">Track work orders</p>
              </div>
              {stats.pendingServiceOrders > 0 && (
                <Badge variant="secondary" className="ml-auto px-3 py-1">
                  {stats.pendingServiceOrders} pending
                </Badge>
              )}
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/worker/supervisor/workers')}
              className="w-full h-auto py-5 flex items-center justify-start gap-4 hover:shadow-md hover:bg-muted/50 transition-all duration-200 border-border/50"
            >
              <div className="p-2 bg-success/10 rounded-lg">
                <Users className="h-7 w-7 text-success" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-base">Worker Management</p>
                <p className="text-xs text-muted-foreground">Team overview</p>
              </div>
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/worker/supervisor/timesheets')}
              className="w-full h-auto py-5 flex items-center justify-start gap-4 hover:shadow-md hover:bg-muted/50 transition-all duration-200 border-border/50"
            >
              <div className="p-2 bg-info/10 rounded-lg">
                <Clock className="h-7 w-7 text-info" />
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-base">Timesheets</p>
                <p className="text-xs text-muted-foreground">Review time logs</p>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Quick Access */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => navigate('/worker/dashboard')}
              className="w-full hover:shadow-md transition-all duration-200"
            >
              Switch to Worker View
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
