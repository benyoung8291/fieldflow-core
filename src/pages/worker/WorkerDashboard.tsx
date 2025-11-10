import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, LogOut, Wifi, WifiOff, User, Download, CheckCircle2, X, Filter, CalendarIcon, Briefcase } from 'lucide-react';
import { useWorkerRole } from '@/hooks/useWorkerRole';
import { format, parseISO, addDays, startOfDay, endOfDay } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@/hooks/use-mobile';
import { cacheAppointments, getCachedAppointments } from '@/lib/offlineSync';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocation } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type ViewFilter = 'today' | 'week' | 'all' | 'custom';

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('week');
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const { isOnline, isSyncing, pendingItems } = useOfflineSync();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const { isSupervisorOrAbove } = useWorkerRole();

  useEffect(() => {
    loadUserAndAppointments();
  }, [viewFilter, customDate]);

  const loadUserAndAppointments = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/worker/auth');
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      setUser(profile);

      // Calculate date range based on filter
      let startDate: string;
      let endDate: string;

      if (viewFilter === 'custom' && customDate) {
        startDate = format(startOfDay(customDate), 'yyyy-MM-dd');
        endDate = format(endOfDay(customDate), "yyyy-MM-dd'T'HH:mm:ss");
      } else if (viewFilter === 'week') {
        startDate = format(new Date(), 'yyyy-MM-dd');
        endDate = format(addDays(new Date(), 7), "yyyy-MM-dd'T'23:59:59");
      } else if (viewFilter === 'today') {
        startDate = format(new Date(), 'yyyy-MM-dd');
        endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59");
      } else {
        // 'all' - get all future appointments
        startDate = format(new Date(), 'yyyy-MM-dd');
        endDate = format(addDays(new Date(), 365), "yyyy-MM-dd'T'23:59:59");
      }

      // Try to load from network first
      if (isOnline) {
        // Get worker ID from user ID
        const { data: workerData } = await supabase
          .from('workers')
          .select('id')
          .eq('id', authUser.id)
          .single();

        if (!workerData) {
          console.error('Worker not found');
          return;
        }

        // Get appointments through junction table
        const { data: appointmentWorkers } = await supabase
          .from('appointment_workers')
          .select(`
            appointment:appointments(
              *,
              service_order:service_orders(
                id,
                work_order_number,
                customer:customers(name, phone)
              )
            )
          `)
          .eq('worker_id', workerData.id)
          .gte('appointment.start_time', startDate)
          .lte('appointment.start_time', endDate);

        if (appointmentWorkers) {
          const fetchedAppointments = appointmentWorkers
            .map((aw: any) => aw.appointment)
            .filter((apt: any) => apt !== null)
            .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
          
          setAppointments(fetchedAppointments);
          await cacheAppointments(fetchedAppointments);
        }
      } else {
        // Load from cache when offline
        const cached = await getCachedAppointments();
        const filteredCached = cached.filter((apt) => {
          const aptDate = new Date(apt.start_time);
          return aptDate >= new Date(startDate) && aptDate <= new Date(endDate);
        });
        setAppointments(filteredCached);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/worker/auth');
  };

  const handleInstallClick = async () => {
    const installed = await promptInstall();
    if (installed) {
      toast.success('App installed successfully!');
      setShowInstallBanner(false);
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setShowInstallBanner(false);
    }
  }, []);

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
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">Service Pulse</h1>
              <p className="text-sm opacity-90">{user?.first_name} {user?.last_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-300" />
            ) : (
              <WifiOff className="h-5 w-5 text-yellow-300" />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {/* Sync Status */}
        {!isOnline && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <WifiOff className="h-5 w-5" />
                <div>
                  <p className="font-medium">Offline Mode</p>
                  <p className="text-sm">Changes will sync when you're back online</p>
                  {pendingItems > 0 && (
                    <p className="text-xs mt-1">{pendingItems} items pending sync</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isSyncing && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800"></div>
                <p className="text-sm">Syncing offline data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Supervisor Access */}
        {isSupervisorOrAbove && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <Button
                onClick={() => navigate('/worker/supervisor/dashboard')}
                className="w-full h-16 flex items-center justify-start gap-3"
              >
                <Briefcase className="h-6 w-6" />
                <div className="text-left">
                  <p className="font-semibold">Supervisor Dashboard</p>
                  <p className="text-xs opacity-90">Manage team & operations</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={() => navigate('/worker/appointments')}
            className="h-24 flex-col gap-2"
          >
            <CalendarDays className="h-8 w-8" />
            <span>All Appointments</span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate('/worker/schedule')}
            className="h-24 flex-col gap-2"
          >
            <Clock className="h-8 w-8" />
            <span>My Schedule</span>
          </Button>
        </div>

        {/* View Filter Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">View:</span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={viewFilter === 'today' ? 'default' : 'outline'}
                  onClick={() => setViewFilter('today')}
                  className="text-xs"
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant={viewFilter === 'week' ? 'default' : 'outline'}
                  onClick={() => setViewFilter('week')}
                  className="text-xs"
                >
                  Next 7 Days
                </Button>
                <Button
                  size="sm"
                  variant={viewFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setViewFilter('all')}
                  className="text-xs"
                >
                  All
                </Button>
              </div>
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    viewFilter === 'custom' && "border-primary",
                    !customDate && viewFilter !== 'custom' && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {customDate && viewFilter === 'custom'
                    ? format(customDate, "PPP")
                    : "Pick a custom date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(date) => {
                    setCustomDate(date);
                    if (date) {
                      setViewFilter('custom');
                    }
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {viewFilter === 'today' && 'Today\'s Appointments'}
              {viewFilter === 'week' && 'Next 7 Days'}
              {viewFilter === 'all' && 'All Upcoming Appointments'}
              {viewFilter === 'custom' && customDate && format(customDate, 'MMMM d, yyyy')}
            </CardTitle>
            <CardDescription>
              {appointments.length} appointment{appointments.length !== 1 ? 's' : ''} scheduled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No appointments scheduled for this period
              </p>
            ) : (
              appointments.map((apt) => (
                <Card
                  key={apt.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/worker/appointments/${apt.id}`)}
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
                        <CalendarDays className="h-4 w-4" />
                        {format(parseISO(apt.start_time), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(parseISO(apt.start_time), 'h:mm a')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
