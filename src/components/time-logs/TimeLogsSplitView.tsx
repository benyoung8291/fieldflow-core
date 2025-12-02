import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@googlemaps/js-api-loader";
import { calculateDistance, formatDistance, getDistanceWarningLevel } from "@/lib/distance";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import DistanceWarningBadge from "./DistanceWarningBadge";
import { getAppointmentLocation } from "@/lib/appointmentLocation";

interface TimeLog {
  id: string;
  worker_id: string;
  appointment_id: string;
  latitude: number | null;
  longitude: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  total_hours: number | null;
  profiles?: {
    first_name: string;
    last_name: string;
  };
  worker?: {
    first_name: string;
    last_name: string;
  };
  appointments?: {
    id: string;
    title: string;
    location_address: string | null;
    location_lat: number | null;
    location_lng: number | null;
  };
}

interface TimeLogsSplitViewProps {
  timeLogs: TimeLog[];
}

export default function TimeLogsSplitView({ timeLogs }: TimeLogsSplitViewProps) {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  // Group time logs by appointment
  const logsByAppointment = timeLogs.reduce((acc: any, log: TimeLog) => {
    const appointmentId = log.appointment_id;
    if (!acc[appointmentId]) {
      acc[appointmentId] = {
        appointment: log.appointments,
        logs: [],
        totalHours: 0,
        workerCount: 0,
        distanceWarnings: 0,
      };
    }
    acc[appointmentId].logs.push(log);
    acc[appointmentId].totalHours += log.total_hours || 0;
    acc[appointmentId].workerCount = new Set(acc[appointmentId].logs.map((l: TimeLog) => l.worker_id)).size;

    // Count distance warnings
    if (log.appointments?.location_lat && log.appointments?.location_lng && log.latitude && log.longitude) {
      const distance = calculateDistance(
        log.appointments.location_lat,
        log.appointments.location_lng,
        log.latitude,
        log.longitude
      );
      if (distance > 2000) {
        acc[appointmentId].distanceWarnings++;
      }
    }

    return acc;
  }, {} as Record<string, any>);

  const appointmentsList = Object.entries(logsByAppointment);

  // Auto-select first appointment
  useEffect(() => {
    if (appointmentsList.length > 0 && !selectedAppointmentId) {
      setSelectedAppointmentId(appointmentsList[0][0]);
    }
  }, [appointmentsList.length]);

  // Initialize and update map when selection changes
  useEffect(() => {
    if (!selectedAppointmentId || !mapRef.current) return;

    const selectedData = logsByAppointment[selectedAppointmentId];
    if (!selectedData) return;

    const initializeMap = async () => {
      const loader = new Loader({
        apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
        version: "weekly",
        libraries: ["maps", "marker"],
      });

      // @ts-ignore - Loader API varies by version
      const google = await loader.load();

      // Determine map center
      const appointment = selectedData.appointment;
      let centerLat = appointment?.location_lat;
      let centerLng = appointment?.location_lng;

      if (!centerLat || !centerLng) {
        const firstWorkerLog = selectedData.logs.find((log: TimeLog) => log.latitude && log.longitude);
        if (firstWorkerLog) {
          centerLat = firstWorkerLog.latitude!;
          centerLng = firstWorkerLog.longitude!;
        }
      }

      if (!centerLat || !centerLng) return;

      // Create or update map
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new google.maps.Map(mapRef.current!, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 15,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
        });
      } else {
        mapInstanceRef.current.setCenter({ lat: centerLat, lng: centerLng });
      }

      const mapInstance = mapInstanceRef.current;

      // Clear existing markers (simple approach - recreate all)
      // In production, you'd want to track and remove individual markers
      const bounds = new google.maps.LatLngBounds();

      // Add appointment location marker (blue)
      if (appointment?.location_lat && appointment?.location_lng) {
        new google.maps.Marker({
          position: { lat: appointment.location_lat, lng: appointment.location_lng },
          map: mapInstance,
          title: "Appointment Location",
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
        bounds.extend({ lat: appointment.location_lat, lng: appointment.location_lng });
      }

      // Add worker clock-in/out markers
      selectedData.logs.forEach((log: TimeLog) => {
        const profile = log.profiles || log.worker;
        const workerName = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown";

        // Clock-in marker (green)
        if (log.latitude && log.longitude) {
          const marker = new google.maps.Marker({
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

          // Calculate distance if appointment location available
          let distanceText = "";
          const logAppointmentLocation = getAppointmentLocation(appointment);
          if (logAppointmentLocation) {
            const distance = calculateDistance(
              logAppointmentLocation.lat,
              logAppointmentLocation.lng,
              log.latitude,
              log.longitude
            );
            distanceText = `<br>Distance: ${formatDistance(distance)}`;
          }

          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 8px;">
              <strong>${workerName}</strong><br>
              Clock In${distanceText}
            </div>`,
          });

          marker.addListener("click", () => {
            infoWindow.open(mapInstance, marker);
          });

          bounds.extend({ lat: log.latitude, lng: log.longitude });
        }

        // Clock-out marker (red)
        if (log.check_out_lat && log.check_out_lng) {
          const marker = new google.maps.Marker({
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

          let distanceText = "";
          if (appointment?.location_lat && appointment?.location_lng) {
            const distance = calculateDistance(
              appointment.location_lat,
              appointment.location_lng,
              log.check_out_lat,
              log.check_out_lng
            );
            distanceText = `<br>Distance: ${formatDistance(distance)}`;
          }

          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 8px;">
              <strong>${workerName}</strong><br>
              Clock Out${distanceText}
            </div>`,
          });

          marker.addListener("click", () => {
            infoWindow.open(mapInstance, marker);
          });

          bounds.extend({ lat: log.check_out_lat, lng: log.check_out_lng });
        }
      });

      // Fit bounds to show all markers
      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds);
      }
    };

    initializeMap();
  }, [selectedAppointmentId, logsByAppointment]);

  if (appointmentsList.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No time logs with location data available</p>
        </CardContent>
      </Card>
    );
  }

  const selectedData = selectedAppointmentId ? logsByAppointment[selectedAppointmentId] : null;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-5 h-[700px]">
          {/* Appointments List - Left Side */}
          <div className="lg:col-span-2 border-r border-border">
            <div className="p-4 border-b border-border bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Appointments ({appointmentsList.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Click to view workers and locations on map
              </p>
            </div>
            <ScrollArea className="h-[calc(700px-73px)]">
              <div className="p-2 space-y-2">
                {appointmentsList.map(([appointmentId, data]: [string, any]) => {
                  const appointment = data.appointment;
                  const isSelected = selectedAppointmentId === appointmentId;

                  return (
                    <div
                      key={appointmentId}
                      onClick={() => setSelectedAppointmentId(appointmentId)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50",
                        isSelected && "bg-primary/10 border-primary shadow-sm"
                      )}
                    >
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm line-clamp-1">
                          {appointment?.title || "Unknown Appointment"}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {appointment?.location_address || "No address"}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            <Users className="h-3 w-3 mr-1" />
                            {data.workerCount} worker{data.workerCount !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            <Clock className="h-3 w-3 mr-1" />
                            {data.totalHours.toFixed(1)}h
                          </Badge>
                          {data.distanceWarnings > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              ⚠️ {data.distanceWarnings} warning{data.distanceWarnings !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          {!appointment?.location_lat && (
                            <Badge variant="outline" className="text-[10px] text-warning border-warning">
                              No GPS
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Map - Right Side */}
          <div className="lg:col-span-3">
            <div className="p-4 border-b border-border bg-muted/30">
              <h3 className="font-semibold">
                {selectedData?.appointment?.title || "Select an appointment"}
              </h3>
              {selectedData && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedData.workerCount} worker{selectedData.workerCount !== 1 ? "s" : ""} • {selectedData.logs.length} time log{selectedData.logs.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            <div className="relative h-[calc(700px-73px)]">
              {/* Legend */}
              <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>Appointment</span>
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
              </div>

              {/* Worker Distance Summary */}
              {selectedData && (
                <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg max-w-xs">
                  <h4 className="font-semibold text-xs mb-2">Workers</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedData.logs.map((log: TimeLog) => {
                      const profile = log.profiles || log.worker;
                      const workerName = profile
                        ? `${profile.first_name} ${profile.last_name}`
                        : "Unknown";
                      
                      const appointment = log.appointments;
                      const checkInDistance =
                        appointment?.location_lat && appointment?.location_lng && log.latitude && log.longitude
                          ? calculateDistance(
                              appointment.location_lat,
                              appointment.location_lng,
                              log.latitude,
                              log.longitude
                            )
                          : null;

                      const level = checkInDistance ? getDistanceWarningLevel(checkInDistance) : null;
                      const levelColors = {
                        ok: "text-success",
                        warning: "text-warning",
                        danger: "text-destructive",
                      };

                      return (
                        <div key={log.id} className="flex items-center justify-between text-xs pb-1.5 border-b">
                          <span className="font-medium truncate mr-2">{workerName}</span>
                          <DistanceWarningBadge 
                            distance={checkInDistance}
                            showIcon={false}
                            workerLat={log.latitude}
                            workerLng={log.longitude}
                            hasAppointmentLocation={!!(appointment?.location_lat && appointment?.location_lng)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Map */}
              <div ref={mapRef} className="w-full h-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
