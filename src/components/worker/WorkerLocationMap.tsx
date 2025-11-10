import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WorkerLocationMapProps {
  activeWorkers: any[];
}

export const WorkerLocationMap = ({ activeWorkers }: WorkerLocationMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    // Check if token is saved in localStorage
    const savedToken = localStorage.getItem('mapbox-token');
    if (savedToken) {
      setMapboxToken(savedToken);
      setTokenSaved(true);
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !tokenSaved || !mapboxToken) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-98.5795, 39.8283], // Center of US
        zoom: 4,
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Add markers for active workers
      if (activeWorkers.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();

        activeWorkers.forEach((worker) => {
          if (worker.latitude && worker.longitude) {
            // Create custom marker
            const el = document.createElement('div');
            el.className = 'worker-marker';
            el.style.backgroundImage = 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMxMGI5ODEiLz4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTIiIGZpbGw9IndoaXRlIi8+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjgiIGZpbGw9IiMxMGI5ODEiLz4KPC9zdmc+)';
            el.style.width = '32px';
            el.style.height = '32px';
            el.style.backgroundSize = 'cover';
            el.style.cursor = 'pointer';

            const marker = new mapboxgl.Marker(el)
              .setLngLat([worker.longitude, worker.latitude])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(`
                  <div style="padding: 8px;">
                    <h3 style="font-weight: bold; margin-bottom: 4px;">
                      ${worker.worker?.first_name} ${worker.worker?.last_name}
                    </h3>
                    <p style="font-size: 14px; color: #666;">
                      ${worker.appointment?.title || 'No appointment'}
                    </p>
                    <p style="font-size: 12px; color: #999; margin-top: 4px;">
                      Clocked in: ${new Date(worker.clock_in).toLocaleTimeString()}
                    </p>
                  </div>
                `)
              )
              .addTo(map.current!);

            markers.current.push(marker);
            bounds.extend([worker.longitude, worker.latitude]);
          }
        });

        // Fit map to show all markers
        if (markers.current.length > 0) {
          map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
        }
      }
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    // Cleanup
    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      map.current?.remove();
    };
  }, [activeWorkers, tokenSaved, mapboxToken]);

  const handleSaveToken = () => {
    if (mapboxToken.trim()) {
      localStorage.setItem('mapbox-token', mapboxToken);
      setTokenSaved(true);
    }
  };

  if (!tokenSaved) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Worker Locations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              To view worker locations on the map, you need to provide a Mapbox access token.
              Get your free token at{' '}
              <a
                href="https://mapbox.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                mapbox.com
              </a>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="mapbox-token">Mapbox Access Token</Label>
            <Input
              id="mapbox-token"
              type="text"
              placeholder="pk.eyJ1..."
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
            />
          </div>

          <Button onClick={handleSaveToken} className="w-full">
            Save Token & Show Map
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Worker Locations ({activeWorkers.filter((w) => w.latitude && w.longitude).length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeWorkers.filter((w) => w.latitude && w.longitude).length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No worker locations available
          </p>
        ) : (
          <div ref={mapContainer} className="w-full h-[500px] rounded-lg" />
        )}
      </CardContent>
    </Card>
  );
};
