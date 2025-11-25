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

        // Optimized query - only fetch needed fields and join time_logs in one query
        // Only show published and scheduled appointments (not draft)
        const { data } = await supabase
          .from('appointment_workers')
          .select(`
            appointment:appointments!inner(
              id,
              title,
              description,
              start_time,
              status,
              location_address,
              service_order_id,
              service_orders!inner(
                work_order_number,
                customers!inner(name)
              )
            )
          `)
          .eq('worker_id', user.id)
          .gte('appointment.start_time', weekStart)
          .lte('appointment.start_time', weekEnd)
          .neq('appointment.status', 'draft')
          .order('appointment(start_time)');

        if (data) {
          // Extract appointments from the response
          const appointments = data.map((item: any) => item.appointment).filter(Boolean);
          setAppointments(appointments);
          await cacheAppointments(appointments);
          
          // Load time logs in parallel
          const appointmentIds = appointments.map((apt: any) => apt.id);
          if (appointmentIds.length > 0) {
            const { data: timeLogs } = await supabase
              .from('time_logs')
              .select('appointment_id, clock_in')
              .in('appointment_id', appointmentIds)
              .eq('worker_id', user.id)
              .is('clock_out', null);
            
            const timeLogsMap: Record<string, any> = {};
            timeLogs?.forEach(log => {
              timeLogsMap[log.appointment_id] = log;
            });
            setActiveTimeLogs(timeLogsMap);
          }
        }
      } else {
        // Offline mode - load from cache
        const cached = await getCachedAppointments();
        setAppointments(cached);
        
        const db = await getDB();
        const cachedTimeLogs = await db.getAll('timeEntries');
        
        const timeLogsMap: Record<string, any> = {};
        cachedTimeLogs
          .filter(log => log.workerId === user.id && log.action === 'clock_in')
          .forEach(log => {
            timeLogsMap[log.appointmentId] = log;
          });
        
        setActiveTimeLogs(timeLogsMap);
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
      <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/worker/dashboard')}
            className="h-9 w-9 rounded-lg text-primary-foreground hover:bg-primary-foreground/15"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold">My Appointments</h1>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {appointments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">No appointments this week</p>
            </CardContent>
          </Card>
        ) : (
          appointments.map((apt) => {
            const isClockedIn = activeTimeLogs[apt.id];
            
            return (
              <Card
                key={apt.id}
                className="card-interactive"
                onClick={() => navigate(`/worker/appointments/${apt.id}`)}
              >
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate leading-tight mb-0.5">{apt.title}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {apt.service_orders?.customers?.name}
                      </p>
                      {isClockedIn && (
                        <Badge variant="outline" className="shrink-0 text-[10px] h-5 border-green-200 text-green-700 mt-2">
                          Active • {formatElapsedTime(isClockedIn.clock_in)}
                        </Badge>
                      )}
                    </div>
                    <Badge 
                      variant={apt.status === 'completed' ? 'default' : 'secondary'}
                      className="shrink-0 text-[10px] h-5"
                    >
                      {apt.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(parseISO(apt.start_time), 'MMM d')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{format(parseISO(apt.start_time), 'h:mm a')}</span>
                    </div>
                  </div>
              </CardContent>
            </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
