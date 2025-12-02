import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@googlemaps/js-api-loader";
import { calculateDistance, formatDistance, getDistanceWarningLevel } from "@/lib/distance";

interface AppointmentTimeLogsMapProps {
  appointmentLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  timeLogs: Array<{
    id: string;
    worker: { first_name: string; last_name: string };
    latitude: number | null;
    longitude: number | null;
    check_out_lat: number | null;
    check_out_lng: number | null;
  }>;
}

export default function AppointmentTimeLogsMap({
  appointmentLocation,
  timeLogs,
}: AppointmentTimeLogsMapProps) {
  const [open, setOpen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !mapRef.current) return;

    const initializeMap = async () => {
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
        version: "weekly",
        libraries: ["maps", "marker"],
      });

      // @ts-ignore - Loader API varies by version
      const google = await loader.load();

      // Determine map center - use appointment location or first worker location
      let centerLat = appointmentLocation.lat;
      let centerLng = appointmentLocation.lng;
      
      if (!centerLat || !centerLng) {
        // Find first worker location
        const firstWorkerLog = timeLogs.find(log => log.latitude && log.longitude);
        if (firstWorkerLog) {
          centerLat = firstWorkerLog.latitude!;
          centerLng = firstWorkerLog.longitude!;
        }
      }

      const mapInstance = new google.maps.Map(mapRef.current!, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      });

      // Add appointment location marker (blue) if available
      if (appointmentLocation.lat && appointmentLocation.lng) {
        new google.maps.Marker({
          position: { lat: appointmentLocation.lat, lng: appointmentLocation.lng },
          map: mapInstance,
          title: "Appointment Location",
          label: {
            text: "📍",
            fontSize: "20px",
          },
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
      }

      // Add worker clock-in/out markers
      timeLogs.forEach((log) => {
        const workerName = `${log.worker.first_name} ${log.worker.last_name}`;

        // Clock-in marker (green)
        if (log.latitude && log.longitude) {
          new google.maps.Marker({
            position: { lat: log.latitude, lng: log.longitude },
            map: mapInstance,
            title: `${workerName} - Clock In`,
            label: {
              text: "IN",
              color: "white",
              fontSize: "10px",
              fontWeight: "bold",
            },
            icon: {
              url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
            },
          });
        }

        // Clock-out marker (red)
        if (log.check_out_lat && log.check_out_lng) {
          new google.maps.Marker({
            position: { lat: log.check_out_lat, lng: log.check_out_lng },
            map: mapInstance,
            title: `${workerName} - Clock Out`,
            label: {
              text: "OUT",
              color: "white",
              fontSize: "10px",
              fontWeight: "bold",
            },
            icon: {
              url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
            },
          });
        }
      });

      // Fit bounds to show all markers
      const bounds = new google.maps.LatLngBounds();
      if (appointmentLocation.lat && appointmentLocation.lng) {
        bounds.extend({ lat: appointmentLocation.lat, lng: appointmentLocation.lng });
      }
      timeLogs.forEach((log) => {
        if (log.latitude && log.longitude) {
          bounds.extend({ lat: log.latitude, lng: log.longitude });
        }
        if (log.check_out_lat && log.check_out_lng) {
          bounds.extend({ lat: log.check_out_lat, lng: log.check_out_lng });
        }
      });
      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds);
      }
    };

    initializeMap();
  }, [open, appointmentLocation, timeLogs]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="h-4 w-4 mr-2" />
          View All Workers on Map
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Appointment Location Verification - All Workers</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Warning if appointment location missing */}
          {(!appointmentLocation.lat || !appointmentLocation.lng) && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
              <strong>Note:</strong> Appointment GPS location not available. Distances cannot be calculated.
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>Appointment Location</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Clock In</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Clock Out</span>
            </div>
          </div>

          {/* Worker Distance Summary */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Distance from Appointment</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {timeLogs.map((log) => {
                const workerName = `${log.worker.first_name} ${log.worker.last_name}`;
                const checkInDistance =
                  appointmentLocation.lat && appointmentLocation.lng && log.latitude && log.longitude
                    ? calculateDistance(
                        appointmentLocation.lat,
                        appointmentLocation.lng,
                        log.latitude,
                        log.longitude
                      )
                    : null;
                const checkOutDistance =
                  appointmentLocation.lat && appointmentLocation.lng && log.check_out_lat && log.check_out_lng
                    ? calculateDistance(
                        appointmentLocation.lat,
                        appointmentLocation.lng,
                        log.check_out_lat,
                        log.check_out_lng
                      )
                    : null;

                const checkInLevel = checkInDistance ? getDistanceWarningLevel(checkInDistance) : null;
                const checkOutLevel = checkOutDistance ? getDistanceWarningLevel(checkOutDistance) : null;

                const levelColors = {
                  ok: "text-success",
                  warning: "text-warning",
                  danger: "text-destructive",
                };

                return (
                  <div key={log.id} className="p-2 border rounded text-xs">
                    <div className="font-medium mb-1">{workerName}</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Clock In:</span>
                        {checkInDistance ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${checkInLevel ? levelColors[checkInLevel] : ""}`}
                          >
                            {formatDistance(checkInDistance)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            No location
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Clock Out:</span>
                        {checkOutDistance ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${checkOutLevel ? levelColors[checkOutLevel] : ""}`}
                          >
                            {formatDistance(checkOutDistance)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            No location
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Map */}
          <div ref={mapRef} className="border rounded-lg overflow-hidden h-[500px] w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
