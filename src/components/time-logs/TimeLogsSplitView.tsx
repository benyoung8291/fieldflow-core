import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@googlemaps/js-api-loader";
import { calculateDistance, formatDistance, getDistanceWarningLevel } from "@/lib/distance";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, Clock, Maximize2, Edit2, Check, X } from "lucide-react";
import { cn, MELBOURNE_TZ } from "@/lib/utils";
import DistanceWarningBadge from "./DistanceWarningBadge";
import { getAppointmentLocation } from "@/lib/appointmentLocation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { useQueryClient } from "@tanstack/react-query";

interface TimeLog {
  id: string;
  worker_id: string;
  appointment_id: string;
  clock_in: string;
  clock_out: string | null;
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
    service_order?: {
      customer_location?: {
        address: string | null;
        formatted_address: string | null;
        latitude: number | null;
        longitude: number | null;
      };
    };
  };
}

interface TimeLogsSplitViewProps {
  timeLogs: TimeLog[];
}

export default function TimeLogsSplitView({ timeLogs }: TimeLogsSplitViewProps) {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isMapMaximized, setIsMapMaximized] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const maximizedMapRef = useRef<HTMLDivElement>(null);
  const maximizedMapInstanceRef = useRef<google.maps.Map | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    if (!selectedAppointmentId) return;

    const selectedData = logsByAppointment[selectedAppointmentId];
    if (!selectedData) return;

    const initMap = async (container: HTMLDivElement, mapInstance: React.MutableRefObject<google.maps.Map | null>) => {
      try {
        setMapLoading(true);
        setMapError(null);

        // Check if API key is available
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error("Google Maps API key not configured");
        }

        // Create loader instance
        const loader = new Loader({
          apiKey,
          version: "weekly",
        });

        // Load the library and import maps
        await loader.importLibrary("maps");
        await loader.importLibrary("marker");

      // Determine map center
      const appointment = selectedData.appointment;
      const appointmentLocation = getAppointmentLocation(appointment);
      let centerLat = appointmentLocation?.lat;
      let centerLng = appointmentLocation?.lng;

      if (!centerLat || !centerLng) {
        const firstWorkerLog = selectedData.logs.find((log: TimeLog) => log.latitude && log.longitude);
        if (firstWorkerLog) {
          centerLat = firstWorkerLog.latitude!;
          centerLng = firstWorkerLog.longitude!;
        }
      }

      if (!centerLat || !centerLng) return;

      // Create or update map
      if (!mapInstance.current) {
        mapInstance.current = new google.maps.Map(container, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 15,
          mapId: "time-logs-map",
        });
      } else {
        mapInstance.current.setCenter({ lat: centerLat, lng: centerLng });
      }

      const map = mapInstance.current;

      // Clear existing markers
      const bounds = new google.maps.LatLngBounds();

      // Add appointment location marker (blue)
      if (appointmentLocation) {
        new google.maps.Marker({
          position: { lat: appointmentLocation.lat, lng: appointmentLocation.lng },
          map: map,
          title: "Appointment Location",
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
        bounds.extend({ lat: appointmentLocation.lat, lng: appointmentLocation.lng });
      }

      // Add worker clock-in/out markers
      selectedData.logs.forEach((log: TimeLog) => {
        const profile = log.profiles || log.worker;
        const workerName = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown";

        // Clock-in marker (green)
        if (log.latitude && log.longitude) {
          const marker = new google.maps.Marker({
            position: { lat: log.latitude, lng: log.longitude },
            map: map,
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

          let distanceText = "";
          if (appointmentLocation) {
            const distance = calculateDistance(
              appointmentLocation.lat,
              appointmentLocation.lng,
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
            infoWindow.open(map, marker);
          });

          bounds.extend({ lat: log.latitude, lng: log.longitude });
        }

        // Clock-out marker (red)
        if (log.check_out_lat && log.check_out_lng) {
          const marker = new google.maps.Marker({
            position: { lat: log.check_out_lat, lng: log.check_out_lng },
            map: map,
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
          if (appointmentLocation) {
            const distance = calculateDistance(
              appointmentLocation.lat,
              appointmentLocation.lng,
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
            infoWindow.open(map, marker);
          });

          bounds.extend({ lat: log.check_out_lat, lng: log.check_out_lng });
        }
      });

      // Fit bounds to show all markers
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
      }

      setMapLoading(false);
    } catch (error: any) {
      console.error("Map initialization error:", error);
      setMapError(error.message || "Failed to load map");
      setMapLoading(false);
    }
    };

    if (mapRef.current) {
      initMap(mapRef.current, mapInstanceRef);
    }
  }, [selectedAppointmentId, logsByAppointment]);

  // Initialize maximized map when dialog opens
  useEffect(() => {
    if (isMapMaximized && maximizedMapRef.current && selectedAppointmentId) {
      const selectedData = logsByAppointment[selectedAppointmentId];
      if (!selectedData) return;

      const initMaximizedMap = async () => {
        // Load Google Maps API
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return;
        
        const loader = new Loader({
          apiKey,
          version: "weekly",
        });

        await loader.importLibrary("maps");
        await loader.importLibrary("marker");

        const appointment = selectedData.appointment;
        const appointmentLocation = getAppointmentLocation(appointment);
        let centerLat = appointmentLocation?.lat;
        let centerLng = appointmentLocation?.lng;

        if (!centerLat || !centerLng) {
          const firstWorkerLog = selectedData.logs.find((log: TimeLog) => log.latitude && log.longitude);
          if (firstWorkerLog) {
            centerLat = firstWorkerLog.latitude!;
            centerLng = firstWorkerLog.longitude!;
          }
        }

        if (!centerLat || !centerLng) return;

        maximizedMapInstanceRef.current = new google.maps.Map(maximizedMapRef.current!, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 15,
          mapId: "time-logs-maximized-map",
        });

        const map = maximizedMapInstanceRef.current;
        const bounds = new google.maps.LatLngBounds();

        // Add appointment location marker
        if (appointmentLocation) {
          new google.maps.Marker({
            position: { lat: appointmentLocation.lat, lng: appointmentLocation.lng },
            map: map,
            title: "Appointment Location",
            icon: {
              url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            },
          });
          bounds.extend({ lat: appointmentLocation.lat, lng: appointmentLocation.lng });
        }

        // Add worker markers
        selectedData.logs.forEach((log: TimeLog) => {
          const profile = log.profiles || log.worker;
          const workerName = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown";

          if (log.latitude && log.longitude) {
            const marker = new google.maps.Marker({
              position: { lat: log.latitude, lng: log.longitude },
              map: map,
              title: `${workerName} - Clock In`,
              label: { text: "IN", color: "white", fontSize: "10px", fontWeight: "bold" },
              icon: { url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png" },
            });

            let distanceText = "";
            if (appointmentLocation) {
              const distance = calculateDistance(
                appointmentLocation.lat,
                appointmentLocation.lng,
                log.latitude,
                log.longitude
              );
              distanceText = `<br>Distance: ${formatDistance(distance)}`;
            }

            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="padding: 8px;"><strong>${workerName}</strong><br>Clock In${distanceText}</div>`,
            });

            marker.addListener("click", () => infoWindow.open(map, marker));
            bounds.extend({ lat: log.latitude, lng: log.longitude });
          }

          if (log.check_out_lat && log.check_out_lng) {
            const marker = new google.maps.Marker({
              position: { lat: log.check_out_lat, lng: log.check_out_lng },
              map: map,
              title: `${workerName} - Clock Out`,
              label: { text: "OUT", color: "white", fontSize: "10px", fontWeight: "bold" },
              icon: { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" },
            });

            let distanceText = "";
            if (appointmentLocation) {
              const distance = calculateDistance(
                appointmentLocation.lat,
                appointmentLocation.lng,
                log.check_out_lat,
                log.check_out_lng
              );
              distanceText = `<br>Distance: ${formatDistance(distance)}`;
            }

            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="padding: 8px;"><strong>${workerName}</strong><br>Clock Out${distanceText}</div>`,
            });

            marker.addListener("click", () => infoWindow.open(map, marker));
            bounds.extend({ lat: log.check_out_lat, lng: log.check_out_lng });
          }
        });

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds);
        }
      };

      initMaximizedMap();
    }
  }, [isMapMaximized, selectedAppointmentId, logsByAppointment]);

  const handleEditTimeLog = (log: TimeLog) => {
    setEditingLogId(log.id);
    // Convert UTC to Melbourne time for display in the input
    setEditClockIn(log.clock_in 
      ? formatInTimeZone(new Date(log.clock_in), MELBOURNE_TZ, "yyyy-MM-dd'T'HH:mm") 
      : "");
    setEditClockOut(log.clock_out 
      ? formatInTimeZone(new Date(log.clock_out), MELBOURNE_TZ, "yyyy-MM-dd'T'HH:mm") 
      : "");
  };

  const handleSaveTimeLog = async (logId: string) => {
    try {
      // Convert Melbourne local time input to UTC ISO string for database
      const clockInUTC = editClockIn 
        ? fromZonedTime(new Date(editClockIn), MELBOURNE_TZ).toISOString() 
        : null;
      const clockOutUTC = editClockOut 
        ? fromZonedTime(new Date(editClockOut), MELBOURNE_TZ).toISOString() 
        : null;

      const { error } = await supabase
        .from("time_logs")
        .update({
          clock_in: clockInUTC,
          clock_out: clockOutUTC,
        })
        .eq("id", logId);

      if (error) throw error;

      toast({
        title: "Time log updated",
        description: "Clock times have been updated successfully.",
      });

      setEditingLogId(null);
      
      // Invalidate queries to refresh data without full page reload
      queryClient.invalidateQueries({ queryKey: ["time-logs"] });
    } catch (error) {
      console.error("Error updating time log:", error);
      toast({
        title: "Error",
        description: "Failed to update time log. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    setEditClockIn("");
    setEditClockOut("");
  };

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
                          {getAppointmentLocation(appointment)?.address || "No address"}
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    {selectedData?.appointment?.title || "Select an appointment"}
                  </h3>
                  {selectedData && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedData.workerCount} worker{selectedData.workerCount !== 1 ? "s" : ""} • {selectedData.logs.length} time log{selectedData.logs.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMapMaximized(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
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
                <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur border rounded-lg shadow-lg max-w-md">
                  <div className="p-3 border-b">
                    <h4 className="font-semibold text-xs">Workers & Times</h4>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="p-3 space-y-2">
                      {selectedData.logs.map((log: TimeLog) => {
                        const profile = log.profiles || log.worker;
                        const workerName = profile
                          ? `${profile.first_name} ${profile.last_name}`
                          : "Unknown";
                        
                        const appointment = log.appointments;
                        const appointmentLocation = getAppointmentLocation(appointment);
                        const checkInDistance =
                          appointmentLocation && log.latitude && log.longitude
                            ? calculateDistance(
                                appointmentLocation.lat,
                                appointmentLocation.lng,
                                log.latitude,
                                log.longitude
                              )
                            : null;

                        const isEditing = editingLogId === log.id;

                        return (
                          <div key={log.id} className="p-2 border rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-xs truncate">{workerName}</span>
                              <div className="flex items-center gap-2">
                                <DistanceWarningBadge 
                                  distance={checkInDistance}
                                  showIcon={false}
                                  workerLat={log.latitude}
                                  workerLng={log.longitude}
                                  hasAppointmentLocation={!!appointmentLocation}
                                />
                                {!isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleEditTimeLog(log)}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {isEditing ? (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Clock In</label>
                                  <Input
                                    type="datetime-local"
                                    value={editClockIn}
                                    onChange={(e) => setEditClockIn(e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Clock Out</label>
                                  <Input
                                    type="datetime-local"
                                    value={editClockOut}
                                    onChange={(e) => setEditClockOut(e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    className="h-6 text-xs flex-1"
                                    onClick={() => handleSaveTimeLog(log.id)}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-xs flex-1"
                                    onClick={handleCancelEdit}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground space-y-0.5">
                                <div>In: {log.clock_in ? format(parseISO(log.clock_in), "MMM d, h:mm a") : "N/A"}</div>
                                <div>Out: {log.clock_out ? format(parseISO(log.clock_out), "MMM d, h:mm a") : "N/A"}</div>
                                <div>Hours: {log.total_hours?.toFixed(2) || "0.00"}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Map Error State */}
              {mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-20">
                  <div className="text-center p-4">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{mapError}</p>
                  </div>
                </div>
              )}

              {/* Map Loading State */}
              {mapLoading && !mapError && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <Skeleton className="h-full w-full" />
                </div>
              )}

              {/* Map */}
              <div ref={mapRef} className="w-full h-full bg-muted" />
            </div>
          </div>
        </div>
      </CardContent>

      {/* Maximized Map Dialog */}
      <Dialog open={isMapMaximized} onOpenChange={setIsMapMaximized}>
        <DialogContent className="max-w-[95vw] h-[95vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>
              {selectedData?.appointment?.title || "Map View"}
            </DialogTitle>
          </DialogHeader>
          <div className="relative h-[calc(95vh-80px)]">
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
              <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur border rounded-lg shadow-lg max-w-md">
                <div className="p-3 border-b">
                  <h4 className="font-semibold text-xs">Workers & Times</h4>
                </div>
                <ScrollArea className="max-h-96">
                  <div className="p-3 space-y-2">
                    {selectedData.logs.map((log: TimeLog) => {
                      const profile = log.profiles || log.worker;
                      const workerName = profile
                        ? `${profile.first_name} ${profile.last_name}`
                        : "Unknown";
                      
                      const appointment = log.appointments;
                      const appointmentLocation = getAppointmentLocation(appointment);
                      const checkInDistance =
                        appointmentLocation && log.latitude && log.longitude
                          ? calculateDistance(
                              appointmentLocation.lat,
                              appointmentLocation.lng,
                              log.latitude,
                              log.longitude
                            )
                          : null;

                      return (
                        <div key={log.id} className="p-2 border rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-xs truncate">{workerName}</span>
                            <DistanceWarningBadge 
                              distance={checkInDistance}
                              showIcon={false}
                              workerLat={log.latitude}
                              workerLng={log.longitude}
                              hasAppointmentLocation={!!appointmentLocation}
                            />
                          </div>
                          <div className="text-[10px] text-muted-foreground space-y-0.5">
                            <div>In: {log.clock_in ? format(parseISO(log.clock_in), "MMM d, h:mm a") : "N/A"}</div>
                            <div>Out: {log.clock_out ? format(parseISO(log.clock_out), "MMM d, h:mm a") : "N/A"}</div>
                            <div>Hours: {log.total_hours?.toFixed(2) || "0.00"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Maximized Map */}
            <div ref={maximizedMapRef} className="w-full h-full bg-muted" />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
