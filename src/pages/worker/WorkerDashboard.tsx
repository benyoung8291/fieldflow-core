import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, LogOut, Wifi, WifiOff, User, Download, CheckCircle2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { cacheAppointments, getCachedAppointments } from '@/lib/offlineSync';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const { isOnline, isSyncing, pendingItems } = useOfflineSync();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  useEffect(() => {
    loadUserAndAppointments();
  }, []);

  const loadUserAndAppointments = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/auth');
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      setUser(profile);

      // Try to load from network first
      if (isOnline) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data: appointments } = await supabase
          .from('appointments')
          .select(`
            *,
            service_order:service_orders(
              id,
              work_order_number,
              customer:customers(name, phone)
            )
          `)
          .contains('assigned_workers', [authUser.id])
          .gte('start_time', today)
          .lt('start_time', `${today}T23:59:59`)
          .order('start_time');

        if (appointments) {
          setTodayAppointments(appointments);
          await cacheAppointments(appointments);
        }
      } else {
        // Load from cache when offline
        const cached = await getCachedAppointments();
        const today = format(new Date(), 'yyyy-MM-dd');
        const todayCached = cached.filter((apt) =>
          apt.start_time?.startsWith(today)
        );
        setTodayAppointments(todayCached);
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
    navigate('/auth');
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
        {/* Install App Banner */}
        {isInstallable && showInstallBanner && !isInstalled && (
          <Alert className="bg-primary/10 border-primary">
            <Download className="h-5 w-5 text-primary" />
            <AlertDescription className="flex items-center justify-between gap-3 ml-2">
              <div className="flex-1">
                <p className="font-medium text-primary mb-1">Install Service Pulse</p>
                <p className="text-sm text-muted-foreground">
                  Install the app for quick access and offline capabilities
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleInstallClick}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Install
                </Button>
                <Button
                  onClick={dismissInstallBanner}
                  size="sm"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Already Installed Badge */}
        {isInstalled && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                <div>
                  <p className="font-medium">App Installed</p>
                  <p className="text-sm text-green-700">
                    You're using the installed version of Service Pulse
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={() => navigate('/worker/appointments')}
            className="h-24 flex-col gap-2"
          >
            <CalendarDays className="h-8 w-8" />
            <span>My Appointments</span>
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

        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Appointments</CardTitle>
            <CardDescription>
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </CardDescription>
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
                  onClick={() => navigate(`/worker/appointments/${apt.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
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
                        {format(parseISO(apt.start_time), 'h:mm a')}
                      </div>
                      <div>
                        {apt.estimated_hours}h estimated
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
