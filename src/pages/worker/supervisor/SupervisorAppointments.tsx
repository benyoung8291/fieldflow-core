import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin, User, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SupervisorAppointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadAppointments();
  }, [statusFilter]);

  const loadAppointments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('appointments')
        .select(`
          *,
          service_order:service_orders(
            id,
            work_order_number,
            customer:customers(name, phone)
          )
        `)
        .gte('start_time', today)
        .order('start_time');

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get workers for each appointment
      const appointmentsWithWorkers = await Promise.all(
        (data || []).map(async (apt) => {
          const { data: workers } = await supabase
            .from('appointment_workers')
            .select(`
              worker:workers(first_name, last_name)
            `)
            .eq('appointment_id', apt.id);

          return {
            ...apt,
            workers: workers?.map((w: any) => w.worker) || [],
          };
        })
      );

      setAppointments(appointmentsWithWorkers);
    } catch (error) {
      console.error('Error loading appointments:', error);
      toast.error('Failed to load appointments');
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
      case 'published':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/worker/supervisor/dashboard')}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Appointments</h1>
              <p className="text-sm opacity-90">{appointments.length} total</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {/* Status Filter */}
        <Card>
          <CardContent className="p-4">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="published">Published</TabsTrigger>
                <TabsTrigger value="checked_in">Active</TabsTrigger>
                <TabsTrigger value="completed">Done</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Appointments List */}
        {loading ? (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : appointments.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <p className="text-center text-muted-foreground">
                No appointments found
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt) => (
              <Card
                key={apt.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/worker/appointments/${apt.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{apt.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {apt.service_order?.customer?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        WO: {apt.service_order?.work_order_number}
                      </p>
                    </div>
                    <Badge className={getStatusColor(apt.status)}>
                      {apt.status?.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(parseISO(apt.start_time), 'MMM d, yyyy')}
                      <Clock className="h-4 w-4 ml-2" />
                      {format(parseISO(apt.start_time), 'h:mm a')}
                    </div>

                    {apt.location_address && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5" />
                        <span className="text-xs">{apt.location_address}</span>
                      </div>
                    )}

                    {apt.workers.length > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="text-xs">
                          {apt.workers.map((w: any) => `${w.first_name} ${w.last_name}`).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
