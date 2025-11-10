import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Briefcase,
  LogIn,
  LogOut as LogOutIcon,
  Navigation,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { queueTimeEntry } from '@/lib/offlineSync';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function WorkerAppointmentDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const { isOnline } = useOfflineSync();

  useEffect(() => {
    loadAppointment();
  }, [id]);

  const loadAppointment = async () => {
    try {
      const { data } = await supabase
        .from('appointments')
        .select(`
          *,
          service_order:service_orders(
            id,
            work_order_number,
            description,
            customer:customers(name, phone, email, primary_address)
          )
        `)
        .eq('id', id)
        .single();

      setAppointment(data);
    } catch (error) {
      console.error('Error loading appointment:', error);
      toast.error('Failed to load appointment');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      // Get current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const timestamp = new Date().toISOString();

      if (isOnline) {
        // Try to sync immediately
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Get tenant_id from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single();

        if (!profile?.tenant_id) throw new Error('Tenant not found');

        const { error } = await supabase.from('time_logs').insert({
          appointment_id: id!,
          worker_id: user.id,
          tenant_id: profile.tenant_id,
          clock_in: timestamp,
        });

        if (error) throw error;

        await supabase
          .from('appointments')
          .update({ status: 'checked_in' })
          .eq('id', id);

        toast.success('Checked in successfully');
      } else {
        // Queue for later sync
        await queueTimeEntry({
          appointmentId: id!,
          action: 'check_in',
          timestamp,
          location,
        });

        toast.success('Checked in offline - will sync when online');
      }

      loadAppointment();
    } catch (error: any) {
      console.error('Error checking in:', error);
      if (error.code === 1) {
        toast.error('Location permission denied');
      } else {
        toast.error('Failed to check in');
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingIn(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const timestamp = new Date().toISOString();

      if (isOnline) {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Find the open time log and update it
        const { data: timeLogs } = await supabase
          .from('time_logs')
          .select('*')
          .eq('appointment_id', id)
          .eq('worker_id', user?.id)
          .is('clock_out', null)
          .order('clock_in', { ascending: false })
          .limit(1);

        if (timeLogs && timeLogs.length > 0) {
          const { error } = await supabase
            .from('time_logs')
            .update({ clock_out: timestamp })
            .eq('id', timeLogs[0].id);

          if (error) throw error;
        }

        await supabase
          .from('appointments')
          .update({ status: 'completed' })
          .eq('id', id);

        toast.success('Checked out successfully');
      } else {
        await queueTimeEntry({
          appointmentId: id!,
          action: 'check_out',
          timestamp,
          location,
        });

        toast.success('Checked out offline - will sync when online');
      }

      loadAppointment();
    } catch (error: any) {
      console.error('Error checking out:', error);
      toast.error('Failed to check out');
    } finally {
      setCheckingIn(false);
    }
  };

  const openInMaps = () => {
    const address = appointment?.service_order?.customer?.primary_address;
    if (!address) return;

    const query = encodeURIComponent(address);
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      window.open(`maps://maps.apple.com/?q=${query}`);
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`);
    }
  };

  if (loading || !appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isCheckedIn = appointment.status === 'checked_in';
  const isCompleted = appointment.status === 'completed';

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3 max-w-screen-lg mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/worker/appointments')}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Appointment Details</h1>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {/* Status and Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{appointment.title}</CardTitle>
              <Badge className={
                isCompleted ? 'bg-green-500' :
                isCheckedIn ? 'bg-blue-500' : 'bg-gray-500'
              }>
                {appointment.status?.replace('_', ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isCompleted && (
              <div className="flex gap-2">
                {!isCheckedIn ? (
                  <Button
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="flex-1"
                    size="lg"
                  >
                    <LogIn className="h-5 w-5 mr-2" />
                    {checkingIn ? 'Checking In...' : 'Check In'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleCheckOut}
                    disabled={checkingIn}
                    className="flex-1"
                    size="lg"
                    variant="secondary"
                  >
                    <LogOutIcon className="h-5 w-5 mr-2" />
                    {checkingIn ? 'Checking Out...' : 'Check Out'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Date & Time */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {format(parseISO(appointment.start_time), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="font-medium">
                  {format(parseISO(appointment.start_time), 'h:mm a')} • {appointment.estimated_hours}h
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{appointment.service_order?.customer?.name}</p>
            {appointment.service_order?.customer?.phone && (
              <p className="text-sm text-muted-foreground">
                {appointment.service_order.customer.phone}
              </p>
            )}
            {appointment.service_order?.customer?.email && (
              <p className="text-sm text-muted-foreground">
                {appointment.service_order.customer.email}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        {appointment.service_order?.customer?.primary_address && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{appointment.service_order.customer.primary_address}</p>
              <Button onClick={openInMaps} variant="outline" className="w-full">
                <Navigation className="h-4 w-4 mr-2" />
                Open in Maps
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Service Order */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Service Order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Work Order: {appointment.service_order?.work_order_number}
            </p>
            {appointment.service_order?.description && (
              <p className="text-sm">{appointment.service_order.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        {appointment.description && (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{appointment.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {appointment.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
