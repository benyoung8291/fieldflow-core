import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, MapPin, Play, Square, Coffee } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function WorkerClock() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentTimeLog, setCurrentTimeLog] = useState<any>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [totalHoursToday, setTotalHoursToday] = useState(0);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    loadTimeData();
    getLocation();
  }, []);

  const getLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          setLocationError('Location access denied. Clock in/out will work without GPS.');
          console.error('Geolocation error:', error);
        }
      );
    } else {
      setLocationError('Location not supported on this device');
    }
  };

  const loadTimeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get worker record with pay rate
      const { data: worker } = await (supabase as any)
        .from('workers')
        .select(`
          id,
          tenant_id,
          pay_rate_category:pay_rate_categories(hourly_rate)
        `)
        .eq('user_id', user.id)
        .single();

      if (!worker) {
        toast.error('Worker profile not found');
        return;
      }

      // Get current active time log
      const { data: activeLog } = await supabase
        .from('time_logs')
        .select('*')
        .eq('worker_id', worker.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentTimeLog(activeLog);

      // Get today's completed logs
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: logs } = await supabase
        .from('time_logs')
        .select('*')
        .eq('worker_id', worker.id)
        .gte('clock_in', `${today}T00:00:00`)
        .not('clock_out', 'is', null)
        .order('clock_in', { ascending: false });

      if (logs) {
        setTodayLogs(logs);
        const total = logs.reduce((sum, log) => sum + (log.total_hours || 0), 0);
        setTotalHoursToday(total);
      }
    } catch (error) {
      console.error('Error loading time data:', error);
      toast.error('Failed to load time data');
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: worker } = await (supabase as any)
        .from('workers')
        .select(`
          id,
          tenant_id,
          pay_rate_category:pay_rate_categories(hourly_rate)
        `)
        .eq('user_id', user.id)
        .single();

      if (!worker) {
        toast.error('Worker profile not found');
        return;
      }

      const hourlyRate = (worker.pay_rate_category as any)?.hourly_rate || 0;

      const { error } = await (supabase as any)
        .from('time_logs')
        .insert({
          tenant_id: worker.tenant_id,
          worker_id: worker.id,
          clock_in: new Date().toISOString(),
          hourly_rate: hourlyRate,
          overhead_percentage: 0,
          latitude: location?.lat,
          longitude: location?.lng,
          notes: location ? `Clocked in at GPS: ${location.lat}, ${location.lng}` : undefined,
        });

      if (error) throw error;

      toast.success('Clocked in successfully!');
      loadTimeData();
    } catch (error: any) {
      console.error('Clock in error:', error);
      toast.error('Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    if (!currentTimeLog) return;

    try {
      const clockOutNotes = location 
        ? `${currentTimeLog.notes || ''}\nClocked out at GPS: ${location.lat}, ${location.lng}`.trim()
        : currentTimeLog.notes;

      const { error } = await supabase
        .from('time_logs')
        .update({
          clock_out: new Date().toISOString(),
          notes: clockOutNotes,
        })
        .eq('id', currentTimeLog.id);

      if (error) throw error;

      toast.success('Clocked out successfully!');
      loadTimeData();
    } catch (error: any) {
      console.error('Clock out error:', error);
      toast.error('Failed to clock out');
    }
  };

  const formatDuration = (clockIn: string) => {
    const start = new Date(clockIn);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6" />
            <h1 className="text-xl font-bold">Time Clock</h1>
          </div>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {/* Location Status */}
        {locationError && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-2 text-yellow-800">
                <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">{locationError}</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={getLocation}
                    className="h-auto p-0 text-yellow-900"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clock In/Out Card */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-8 text-center space-y-6">
            {currentTimeLog ? (
              <>
                <div>
                  <Badge className="bg-green-500 text-white text-base px-4 py-2">
                    Currently Clocked In
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Started at</p>
                  <p className="text-3xl font-bold">
                    {format(new Date(currentTimeLog.clock_in), 'h:mm a')}
                  </p>
                  <p className="text-lg text-muted-foreground mt-2">
                    Duration: {formatDuration(currentTimeLog.clock_in)}
                  </p>
                </div>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleClockOut}
                  className="w-full h-16 text-lg gap-2"
                >
                  <Square className="h-6 w-6" />
                  Clock Out
                </Button>
              </>
            ) : (
              <>
                <div>
                  <Clock className="h-16 w-16 mx-auto text-primary mb-4" />
                  <p className="text-xl font-semibold">Ready to start your shift?</p>
                  <p className="text-muted-foreground mt-2">
                    {format(new Date(), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-2xl font-bold mt-2">
                    {format(new Date(), 'h:mm a')}
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleClockIn}
                  className="w-full h-16 text-lg gap-2"
                >
                  <Play className="h-6 w-6" />
                  Clock In
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Daily Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-primary">
                  {(totalHoursToday + (currentTimeLog ? parseFloat(formatDuration(currentTimeLog.clock_in).split('h')[0]) : 0)).toFixed(1)}h
                </p>
                <p className="text-sm text-muted-foreground">Total Hours</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">
                  {todayLogs.length + (currentTimeLog ? 1 : 0)}
                </p>
                <p className="text-sm text-muted-foreground">Clock Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Time Logs */}
        {todayLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today's Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Coffee className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {format(new Date(log.clock_in), 'h:mm a')} - {format(new Date(log.clock_out), 'h:mm a')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {log.total_hours?.toFixed(2)}h
                      </p>
                    </div>
                  </div>
                  {log.appointment_id && (
                    <Badge variant="outline">Job Site</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
