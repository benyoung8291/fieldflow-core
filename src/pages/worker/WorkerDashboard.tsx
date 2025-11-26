import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, LogOut, Wifi, WifiOff, User, Download, CheckCircle2, X, Filter, CalendarIcon, Briefcase, FileText, ChevronRight, RefreshCw } from 'lucide-react';
import { useWorkerRole } from '@/hooks/useWorkerRole';
import { format, parseISO, addDays, startOfDay, endOfDay } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/worker/PullToRefreshIndicator';
import { cacheAppointments, getCachedAppointments } from '@/lib/offlineSync';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocation } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ViewToggleButton } from '@/components/layout/ViewToggleButton';

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
  const { clearCacheAndReload } = usePWAUpdate();
  const { isSupervisorOrAbove } = useWorkerRole();

  const { containerRef, isRefreshing: isPulling, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadUserAndAppointments();
    },
  });

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
    <div ref={containerRef} className="min-h-screen bg-background pb-20">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isPulling} />
      {/* Clean Modern Header */}
      <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary-foreground/15 backdrop-blur-sm flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-medium opacity-70 leading-tight">Welcome back</p>
                <h1 className="text-sm font-semibold leading-tight">{user?.first_name} {user?.last_name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isInstallable && !isInstalled && (
                <Button
                  onClick={promptInstall}
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 rounded-lg text-primary-foreground hover:bg-primary-foreground/15"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Install
                </Button>
              )}
              {isOnline ? (
                <div className="h-7 w-7 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
                  <Wifi className="h-3 w-3" />
                </div>
              ) : (
                <div className="h-7 w-7 rounded-lg bg-warning/30 flex items-center justify-center">
                  <WifiOff className="h-3 w-3 text-warning-foreground" />
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-7 w-7 rounded-lg text-primary-foreground hover:bg-primary-foreground/15"
              >
                <LogOut className="h-3 w-3" />
              </Button>
              <ViewToggleButton />
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={clearCacheAndReload}
                className="h-7 w-7 rounded-lg text-primary-foreground hover:bg-primary-foreground/15"
                title="Clear cache and update"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {/* Status Cards */}
        {!isOnline && (
          <Card className="bg-warning/5 border-warning/20 animate-fade-in">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                  <WifiOff className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Offline Mode</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Changes will sync when back online
                  </p>
                  {pendingItems > 0 && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {pendingItems} pending
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isSyncing && (
          <Card className="bg-info/5 border-info/20 animate-fade-in">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-info border-t-transparent"></div>
                <p className="text-sm font-medium">Syncing data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Supervisor Access */}
        {isSupervisorOrAbove && (
          <Card className="border-primary/20 card-interactive overflow-hidden">
            <CardContent className="p-0">
              <button
                onClick={() => navigate('/worker/supervisor/dashboard')}
                className="w-full p-3.5 flex items-center gap-3 text-left bg-gradient-to-br from-primary/5 to-transparent"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Supervisor Dashboard</p>
                  <p className="text-xs text-muted-foreground">Manage team & operations</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => navigate('/worker/appointments')}
            className="bg-primary text-primary-foreground rounded-xl p-3.5 flex flex-col items-center justify-center gap-2 shadow-sm mobile-tap min-h-[90px]"
          >
            <CalendarDays className="h-5 w-5" />
            <span className="text-[11px] font-medium text-center leading-tight">All<br/>Appointments</span>
          </button>
          <button
            onClick={() => navigate('/worker/schedule')}
            className="bg-card border border-border/50 rounded-xl p-3.5 flex flex-col items-center justify-center gap-2 shadow-sm mobile-tap min-h-[90px]"
          >
            <Clock className="h-5 w-5 text-foreground" />
            <span className="text-[11px] font-medium text-center leading-tight">My<br/>Schedule</span>
          </button>
          <button
            onClick={() => navigate('/worker/field-report-new')}
            className="bg-card border border-border/50 rounded-xl p-3.5 flex flex-col items-center justify-center gap-2 shadow-sm mobile-tap min-h-[90px]"
          >
            <FileText className="h-5 w-5 text-foreground" />
            <span className="text-[11px] font-medium text-center leading-tight">Field<br/>Report</span>
          </button>
        </div>

        {/* View Filter */}
        <Card>
          <CardContent className="p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">View</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewFilter === 'today' ? 'default' : 'outline'}
                onClick={() => setViewFilter('today')}
                className="flex-1 h-8 text-xs rounded-lg"
              >
                Today
              </Button>
              <Button
                size="sm"
                variant={viewFilter === 'week' ? 'default' : 'outline'}
                onClick={() => setViewFilter('week')}
                className="flex-1 h-8 text-xs rounded-lg"
              >
                Next 7 Days
              </Button>
              <Button
                size="sm"
                variant={viewFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setViewFilter('all')}
                className="flex-1 h-8 text-xs rounded-lg"
              >
                All
              </Button>
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start h-8 text-xs rounded-lg",
                    viewFilter === 'custom' && "border-primary text-primary"
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                  {customDate && viewFilter === 'custom'
                    ? format(customDate, "PPP")
                    : "Pick custom date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover/95 backdrop-blur-xl" align="start">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={(date) => {
                    setCustomDate(date);
                    if (date) setViewFilter('custom');
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {/* Appointments Section */}
        <div className="space-y-2.5 pb-2">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold">
                {viewFilter === 'today' && 'Today'}
                {viewFilter === 'week' && 'Next 7 Days'}
                {viewFilter === 'all' && 'All Upcoming'}
                {viewFilter === 'custom' && customDate && format(customDate, 'MMM d, yyyy')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {appointments.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No appointments scheduled</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {appointments.map((apt) => (
                <Card
                  key={apt.id}
                  className="card-interactive"
                  onClick={() => navigate(`/worker/appointments/${apt.id}`)}
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate leading-tight">{apt.title}</h3>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {apt.service_order?.customer?.name}
                        </p>
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
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{format(parseISO(apt.start_time), 'MMM d')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{format(parseISO(apt.start_time), 'h:mm a')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
