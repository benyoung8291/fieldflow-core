import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Calendar, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { WorkerLocationMapLazy } from '@/components/worker/WorkerLocationMapLazy';

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const [activeWorkers, setActiveWorkers] = useState<any[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    
    // Set up realtime subscription for time logs
    const channel = supabase
      .channel('supervisor-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_logs',
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Load currently clocked in workers
      const { data: timeLogs } = await supabase
        .from('time_logs')
        .select(`
          *,
          worker:profiles!time_logs_worker_id_fkey(
            id,
            first_name,
            last_name
          ),
          appointment:appointments(
            id,
            title,
            location,
            latitude,
            longitude
          )
        `)
        .is('clock_out', null)
        .order('clock_in', { ascending: false });

      setActiveWorkers(timeLogs || []);

      // Load today's appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`
          *,
          service_order:service_orders(
            id,
            work_order_number,
            customer:customers(name)
          )
        `)
        .gte('start_time', today)
        .lt('start_time', `${today}T23:59:59`)
        .order('start_time');

      setTodayAppointments(appointments || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'checked_in':
        return 'bg-blue-500';
      case 'in_progress':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-14">
      <header className="bg-gradient-to-br from-primary to-primary-hover text-primary-foreground p-4 sticky top-14 z-10 shadow-md">
        <div className="flex items-center gap-3 max-w-screen-lg mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/worker/dashboard')}
            className="text-primary-foreground hover:bg-primary-foreground/10 h-10 w-10 rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Supervisor Dashboard</h1>
            <p className="text-sm opacity-90">Team Overview</p>
          </div>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4">
        <Tabs defaultValue="workers" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="workers">
              <Users className="h-4 w-4 mr-2" />
              Workers ({activeWorkers.length})
            </TabsTrigger>
            <TabsTrigger value="appointments">
              <Calendar className="h-4 w-4 mr-2" />
              Appointments
            </TabsTrigger>
            <TabsTrigger value="map">
              <MapPin className="h-4 w-4 mr-2" />
              Map
            </TabsTrigger>
          </TabsList>

          {/* Active Workers Tab */}
          <TabsContent value="workers" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Currently Clocked In
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeWorkers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No workers currently clocked in
                  </p>
                ) : (
                  activeWorkers.map((log) => (
                    <Card key={log.id} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">
                              {log.worker?.first_name} {log.worker?.last_name}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {log.appointment?.title || 'No appointment'}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4" />
                              Clocked in: {format(new Date(log.clock_in), 'h:mm a')}
                            </div>
                            {log.appointment?.location && (
                              <div className="flex items-center gap-2 text-sm mt-1">
                                <MapPin className="h-4 w-4" />
                                {log.appointment.location}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="bg-blue-500 text-white">
                            Active
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Today's Appointments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayAppointments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No appointments scheduled for today
                  </p>
                ) : (
                  todayAppointments.map((apt) => (
                    <Card
                      key={apt.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/appointments/${apt.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold">{apt.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {apt.service_order?.customer?.name}
                            </p>
                          </div>
                          <Badge className={getStatusColor(apt.status)}>
                            {apt.status?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(new Date(apt.start_time), 'h:mm a')}
                          </div>
                          <div>{apt.estimated_hours}h</div>
                          {apt.assigned_workers && (
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {apt.assigned_workers.length} workers
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map">
            <WorkerLocationMapLazy activeWorkers={activeWorkers} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
