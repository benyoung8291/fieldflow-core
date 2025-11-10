import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, ArrowLeft, Clock, Users, Calendar, ListTodo, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Loader } from '@googlemaps/js-api-loader';

interface WorkerLocation {
  id: string;
  first_name: string;
  last_name: string;
  latitude: number | null;
  longitude: number | null;
  status: 'clocked_in' | 'clocked_out' | 'on_break';
  current_appointment?: {
    title: string;
    location_address: string;
  };
  last_update?: string;
}

export default function SupervisorMapDashboard() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [workers, setWorkers] = useState<WorkerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<WorkerLocation | null>(null);

  useEffect(() => {
    initializeMap();
    loadWorkerLocations();
    
    // Set up real-time subscription for worker location updates
    const channel = supabase
      .channel('worker-locations')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        updateWorkersFromPresence(state);
      })
      .subscribe();

    // Refresh locations every 30 seconds
    const interval = setInterval(loadWorkerLocations, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const initializeMap = async () => {
    if (!mapRef.current) return;

    try {
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        version: 'weekly',
        libraries: ['maps', 'marker'],
      });

      // @ts-ignore - Loader API varies by version
      const google = await loader.load();

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: -27.4698, lng: 153.0251 }, // Brisbane, Australia default
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
      });

      mapInstanceRef.current = map;
    } catch (error) {
      console.error('Error loading map:', error);
      toast.error('Failed to load map');
    }
  };

  const loadWorkerLocations = async () => {
    try {
      // Get active time logs with worker and appointment details
      const { data: timeLogs } = await supabase
        .from('time_logs')
        .select(`
          *,
          worker:workers!time_logs_worker_id_fkey(
            id,
            first_name,
            last_name
          ),
          appointment:appointments(
            id,
            title,
            location_address
          )
        `)
        .is('clock_out_time', null)
        .order('clock_in_time', { ascending: false });

      if (timeLogs) {
        const workerLocations: WorkerLocation[] = timeLogs.map((log: any) => ({
          id: log.worker.id,
          first_name: log.worker.first_name,
          last_name: log.worker.last_name,
          latitude: log.clock_in_lat,
          longitude: log.clock_in_lng,
          status: 'clocked_in',
          current_appointment: log.appointment ? {
            title: log.appointment.title,
            location_address: log.appointment.location_address,
          } : undefined,
          last_update: log.clock_in_time,
        }));

        setWorkers(workerLocations);
        updateMapMarkers(workerLocations);
      }
    } catch (error) {
      console.error('Error loading worker locations:', error);
      toast.error('Failed to load worker locations');
    } finally {
      setLoading(false);
    }
  };

  const updateWorkersFromPresence = (state: any) => {
    const updatedWorkers: WorkerLocation[] = [];
    
    Object.keys(state).forEach(key => {
      const presences = state[key];
      presences.forEach((presence: any) => {
        if (presence.latitude && presence.longitude) {
          updatedWorkers.push({
            id: presence.worker_id,
            first_name: presence.first_name,
            last_name: presence.last_name,
            latitude: presence.latitude,
            longitude: presence.longitude,
            status: presence.status,
            current_appointment: presence.current_appointment,
            last_update: presence.updated_at,
          });
        }
      });
    });

    if (updatedWorkers.length > 0) {
      setWorkers(updatedWorkers);
      updateMapMarkers(updatedWorkers);
    }
  };

  const updateMapMarkers = (workerLocations: WorkerLocation[]) => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    workerLocations.forEach(worker => {
      if (worker.latitude && worker.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: worker.latitude, lng: worker.longitude },
          map: mapInstanceRef.current,
          title: `${worker.first_name} ${worker.last_name}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: worker.status === 'clocked_in' ? '#22c55e' : '#ef4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => {
          setSelectedWorker(worker);
        });

        markersRef.current.push(marker);
      }
    });

    // Fit map to show all markers
    if (markersRef.current.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markersRef.current.forEach(marker => {
        const position = marker.getPosition();
        if (position) bounds.extend(position);
      });
      mapInstanceRef.current.fitBounds(bounds);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clocked_in':
        return 'bg-green-500';
      case 'on_break':
        return 'bg-yellow-500';
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
              <h1 className="text-xl font-bold">Worker Locations</h1>
              <p className="text-sm opacity-90">{workers.length} active workers</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadWorkerLocations}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto p-4 space-y-4">
        {/* Map */}
        <Card>
          <CardContent className="p-0">
            <div ref={mapRef} className="w-full h-[400px] rounded-lg" />
          </CardContent>
        </Card>

        {/* Selected Worker Details */}
        {selectedWorker && (
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>
                    {selectedWorker.first_name} {selectedWorker.last_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Last updated: {selectedWorker.last_update ? 
                      new Date(selectedWorker.last_update).toLocaleTimeString() : 
                      'Unknown'}
                  </p>
                </div>
                <Badge className={getStatusColor(selectedWorker.status)}>
                  {selectedWorker.status.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedWorker.current_appointment && (
                <>
                  <div>
                    <p className="text-sm font-medium">Current Job:</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedWorker.current_appointment.title}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Location:</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedWorker.current_appointment.location_address}
                    </p>
                  </div>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={() => setSelectedWorker(null)}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Active Workers List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Workers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-center text-muted-foreground py-4">Loading...</p>
            ) : workers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No workers currently clocked in
              </p>
            ) : (
              workers.map((worker) => (
                <Card
                  key={worker.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedWorker(worker)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {worker.first_name} {worker.last_name}
                          </p>
                          {worker.current_appointment && (
                            <p className="text-xs text-muted-foreground">
                              {worker.current_appointment.title}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={getStatusColor(worker.status)}>
                        {worker.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/worker/supervisor/appointments')}
            className="h-20 flex-col gap-2"
          >
            <Calendar className="h-6 w-6" />
            <span className="text-sm">Appointments</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/worker/supervisor/service-orders')}
            className="h-20 flex-col gap-2"
          >
            <ListTodo className="h-6 w-6" />
            <span className="text-sm">Service Orders</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
