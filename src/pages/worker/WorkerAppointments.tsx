import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cacheAppointments, getCachedAppointments, getDB } from '@/lib/offlineSync';

export default function WorkerAppointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTimeLogs, setActiveTimeLogs] = useState<Record<string, any>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const { isOnline } = useOfflineSync();

  // Update current time every second for elapsed time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [isOnline]);

  const loadAppointments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isOnline) {
        const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');
        const weekEnd = format(endOfWeek(new Date()), 'yyyy-MM-dd');

        const { data } = await supabase
          .from('appointments')
          .select(`
            *,
            service_order:service_orders(
              id,
              work_order_number,
              customer:customers(name, phone, email)
            )
          `)
          .contains('assigned_workers', [user.id])
          .gte('start_time', weekStart)
          .lte('start_time', weekEnd)
          .order('start_time');

        if (data) {
          setAppointments(data);
          await cacheAppointments(data);
          
          // Load active time logs for all appointments
          const appointmentIds = data.map(apt => apt.id);
          const { data: timeLogs } = await supabase
            .from('time_logs')
            .select('*')
            .in('appointment_id', appointmentIds)
            .eq('worker_id', user.id)
            .is('clock_out', null);
          
          // Create a map of appointment_id -> time_log
          const timeLogsMap: Record<string, any> = {};
          timeLogs?.forEach(log => {
            timeLogsMap[log.appointment_id] = log;
          });
          setActiveTimeLogs(timeLogsMap);
        }
      } else {
        // Offline mode - load from cache
        const cached = await getCachedAppointments();
        setAppointments(cached);
        
        // Load cached time logs
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const db = await getDB();
          const cachedTimeLogs = await db.getAll('timeEntries');
          
          // Filter for active (clock_in without clock_out) time logs for this worker
          const timeLogsMap: Record<string, any> = {};
          cachedTimeLogs
            .filter(log => log.workerId === user.id && log.action === 'clock_in')
            .forEach(log => {
              timeLogsMap[log.appointmentId] = log;
            });
          
          setActiveTimeLogs(timeLogsMap);
        }
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };


  const formatElapsedTime = (clockInTime: string) => {
    const start = new Date(clockInTime);
    const diffMs = currentTime.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
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
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3 max-w-screen-lg mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/worker/dashboard')}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">My Appointments</h1>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {appointments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No appointments this week</p>
            </CardContent>
          </Card>
        ) : (
          appointments.map((apt) => {
            const isClockedIn = activeTimeLogs[apt.id];
            
            return (
              <Card
                key={apt.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/worker/appointments/${apt.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{apt.title}</h3>
                        {isClockedIn && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                              </div>
                              <span className="text-xs font-medium text-green-600">Clocked In</span>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono border-green-200 text-green-700">
                              {formatElapsedTime(isClockedIn.timestamp || isClockedIn.clock_in)}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {apt.service_order?.customer?.name}
                      </p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        {format(parseISO(apt.start_time), 'EEEE, MMM d')}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                        <Clock className="h-4 w-4" />
                        {format(parseISO(apt.start_time), 'h:mm a')} • {apt.estimated_hours}h
                      </div>
                      {apt.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {apt.location}
                        </div>
                      )}
                    </div>
                    {isClockedIn ? (
                      <Badge className="bg-blue-500 text-white">
                        Clocked In
                      </Badge>
                    ) : (
                      <Badge className={getStatusColor(apt.status)}>
                        {apt.status?.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                {apt.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {apt.description}
                  </p>
                )}
              </CardContent>
            </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
