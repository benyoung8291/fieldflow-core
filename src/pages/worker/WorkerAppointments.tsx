import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cacheAppointments, getCachedAppointments } from '@/lib/offlineSync';

export default function WorkerAppointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOnline } = useOfflineSync();

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
        }
      } else {
        const cached = await getCachedAppointments();
        setAppointments(cached);
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
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
          appointments.map((apt) => (
            <Card
              key={apt.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/worker/appointments/${apt.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{apt.title}</h3>
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
                  <Badge className={getStatusColor(apt.status)}>
                    {apt.status?.replace('_', ' ')}
                  </Badge>
                </div>
                {apt.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {apt.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
