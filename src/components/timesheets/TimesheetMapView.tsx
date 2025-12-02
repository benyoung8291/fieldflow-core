import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@googlemaps/js-api-loader";

interface TimesheetMapViewProps {
  timeLog: any;
}

export default function TimesheetMapView({ timeLog }: TimesheetMapViewProps) {
  const [open, setOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  const hasAppointmentLocation = timeLog.appointments?.location_lat && timeLog.appointments?.location_lng;
  const hasCheckInLocation = timeLog.latitude && timeLog.longitude;
  const hasCheckOutLocation = timeLog.check_out_lat && timeLog.check_out_lng;

  if (!hasAppointmentLocation && !hasCheckInLocation && !hasCheckOutLocation) {
    return null;
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  let checkInDistance: number | null = null;
  let checkOutDistance: number | null = null;

  if (hasAppointmentLocation && hasCheckInLocation) {
    checkInDistance = calculateDistance(
      timeLog.appointments.location_lat,
      timeLog.appointments.location_lng,
      timeLog.latitude,
      timeLog.longitude
    );
  }

  if (hasAppointmentLocation && hasCheckOutLocation) {
    checkOutDistance = calculateDistance(
      timeLog.appointments.location_lat,
      timeLog.appointments.location_lng,
      timeLog.check_out_lat,
      timeLog.check_out_lng
    );
  }

  const getDistanceColor = (distance: number | null) => {
    if (!distance) return "text-muted-foreground";
    if (distance <= 500) return "text-success";
    if (distance <= 2000) return "text-warning";
    return "text-destructive";
  };

  useEffect(() => {
    if (!open || !mapRef.current) return;

    const initializeMap = async () => {
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
        version: "weekly",
        libraries: ['maps', 'marker'],
      });

      // @ts-ignore - Loader API varies by version
      const google = await loader.load();

      const center = hasAppointmentLocation
        ? { lat: timeLog.appointments.location_lat, lng: timeLog.appointments.location_lng }
        : hasCheckInLocation
        ? { lat: timeLog.latitude, lng: timeLog.longitude }
        : { lat: timeLog.check_out_lat, lng: timeLog.check_out_lng };

      const mapInstance = new google.maps.Map(mapRef.current!, {
        center,
        zoom: 16,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      });

      setMap(mapInstance);

      // Add appointment location marker (blue)
      if (hasAppointmentLocation) {
        new google.maps.Marker({
          position: { lat: timeLog.appointments.location_lat, lng: timeLog.appointments.location_lng },
          map: mapInstance,
          title: "Appointment Location",
          label: {
            text: "A",
            color: "white",
            fontWeight: "bold",
          },
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
      }

      // Add check-in marker (green)
      if (hasCheckInLocation) {
        new google.maps.Marker({
          position: { lat: timeLog.latitude, lng: timeLog.longitude },
          map: mapInstance,
          title: "Check In Location",
          label: {
            text: "I",
            color: "white",
            fontWeight: "bold",
          },
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
          },
        });
      }

      // Add check-out marker (red)
      if (hasCheckOutLocation) {
        new google.maps.Marker({
          position: { lat: timeLog.check_out_lat, lng: timeLog.check_out_lng },
          map: mapInstance,
          title: "Check Out Location",
          label: {
            text: "O",
            color: "white",
            fontWeight: "bold",
          },
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
          },
        });
      }

      // Fit bounds to show all markers
      const bounds = new google.maps.LatLngBounds();
      if (hasAppointmentLocation) {
        bounds.extend({ lat: timeLog.appointments.location_lat, lng: timeLog.appointments.location_lng });
      }
      if (hasCheckInLocation) {
        bounds.extend({ lat: timeLog.latitude, lng: timeLog.longitude });
      }
      if (hasCheckOutLocation) {
        bounds.extend({ lat: timeLog.check_out_lat, lng: timeLog.check_out_lng });
      }
      mapInstance.fitBounds(bounds);
      
      // Adjust zoom if only one marker
      const markerCount = [hasAppointmentLocation, hasCheckInLocation, hasCheckOutLocation].filter(Boolean).length;
      if (markerCount === 1) {
        mapInstance.setZoom(16);
      }
    };

    initializeMap();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="h-4 w-4 mr-1" />
          Location
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Time Log Location Verification</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-semibold">Appointment Location</span>
              </div>
              {hasAppointmentLocation ? (
                <div className="text-sm text-muted-foreground">
                  {timeLog.appointments.location_address}
                </div>
              ) : (
                <Badge variant="outline" className="text-xs">No location data</Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-success" />
                <span className="font-semibold">Check In</span>
              </div>
              {hasCheckInLocation ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    Lat: {timeLog.latitude.toFixed(6)}<br />
                    Lng: {timeLog.longitude.toFixed(6)}
                  </div>
                  {checkInDistance !== null && (
                    <Badge variant="outline" className={`text-xs ${getDistanceColor(checkInDistance)}`}>
                      {checkInDistance.toFixed(0)}m from site
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="text-xs">No location captured</Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-info" />
                <span className="font-semibold">Check Out</span>
              </div>
              {hasCheckOutLocation ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    Lat: {timeLog.check_out_lat.toFixed(6)}<br />
                    Lng: {timeLog.check_out_lng.toFixed(6)}
                  </div>
                  {checkOutDistance !== null && (
                    <Badge variant="outline" className={`text-xs ${getDistanceColor(checkOutDistance)}`}>
                      {checkOutDistance.toFixed(0)}m from site
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="outline" className="text-xs">No location captured</Badge>
              )}
            </div>
          </div>

          <div ref={mapRef} className="border rounded-lg overflow-hidden h-[500px] w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
