import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, User, RefreshCw, Briefcase, ChevronRight, WifiOff } from 'lucide-react';
import { useWorkerRole } from '@/hooks/useWorkerRole';
import { ViewToggleButton } from '@/components/layout/ViewToggleButton';
import { format, parseISO, addDays, startOfDay, endOfDay } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/worker/PullToRefreshIndicator';
import { APP_VERSION } from '@/lib/version';
import { cacheAppointments, getCachedAppointments } from '@/lib/offlineSync';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLocation } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type ViewFilter = 'today' | 'week' | 'all' | 'custom';

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { isOnline, isSyncing, pendingItems } = useOfflineSync();
  const { clearCacheAndReload } = usePWAUpdate();
  const { isSupervisorOrAbove } = useWorkerRole();

  const { containerRef, isRefreshing: isPulling, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadUserAndAppointments();
    },
  });

  useEffect(() => {
    loadUserAndAppointments();
  }, []);

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

      // Get today's appointments only
      const startDate = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(new Date(), "yyyy-MM-dd'T'23:59:59");

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
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        
        const filteredCached = cached.filter((apt) => {
          const aptDate = new Date(apt.start_time);
          return aptDate >= startOfToday && aptDate <= endOfToday;
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
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium opacity-90">Welcome back</p>
                <h1 className="text-base font-bold">{user?.first_name} {user?.last_name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" title="Online" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]" title="Offline" />
              )}
              <ViewToggleButton />
              <Button
                variant="ghost"
                size="icon"
                onClick={clearCacheAndReload}
                className="h-8 w-8 rounded-full text-primary-foreground hover:bg-primary-foreground/20"
                title="Update app"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 pt-6 space-y-4">
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
          <Card className="border-primary/20 overflow-hidden shadow-sm">
            <button
              onClick={() => navigate('/worker/supervisor/dashboard')}
              className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors mobile-tap"
            >
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base">Supervisor Dashboard</p>
                <p className="text-sm text-muted-foreground">Manage team & operations</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </Card>
        )}

        {/* Today's Appointments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Today's Schedule</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
              </p>
            </div>
            {appointments.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/worker/appointments')}
                className="text-primary h-8 px-3 text-sm font-medium"
              >
                View All
              </Button>
            )}
          </div>

          {appointments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-base font-medium text-muted-foreground mb-1">No appointments today</p>
                <p className="text-sm text-muted-foreground/70">Your schedule is clear</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {appointments.slice(0, 5).map((apt) => (
                <Card
                  key={apt.id}
                  className="card-interactive overflow-hidden shadow-sm"
                  onClick={() => navigate(`/worker/appointments/${apt.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate mb-1">{apt.title}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {apt.service_order?.customer?.name}
                        </p>
                      </div>
                      <Badge 
                        variant={apt.status === 'completed' ? 'default' : 'secondary'}
                        className="shrink-0 text-xs h-6 px-2.5"
                      >
                        {apt.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        <span>{format(parseISO(apt.start_time), 'MMM d')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{format(parseISO(apt.start_time), 'h:mm a')}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 pt-8 pb-4 text-xs text-muted-foreground/50">
          v{APP_VERSION}
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
