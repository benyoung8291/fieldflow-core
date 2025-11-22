import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Navigation, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GPSCheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  onSuccess?: () => void;
}

export default function GPSCheckInDialog({ 
  open, 
  onOpenChange, 
  appointment,
  onSuccess 
}: GPSCheckInDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;
          setCurrentLocation({ lat: currentLat, lng: currentLng });

          if (appointment.location_lat && appointment.location_lng) {
            const dist = calculateDistance(
              currentLat,
              currentLng,
              appointment.location_lat,
              appointment.location_lng
            );
            setDistance(Math.round(dist));
          }
          setLoading(false);
        },
        (error) => {
          let title = "Error getting location";
          let description = "";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              title = "Location permission denied";
              description = "Please enable location access in your browser settings:\n\niPhone: Settings > Safari > Location > Allow\nAndroid: Settings > Apps > Browser > Permissions > Location";
              break;
            case error.POSITION_UNAVAILABLE:
              title = "Location unavailable";
              description = "Unable to determine your location. Make sure location services are enabled on your device.";
              break;
            case error.TIMEOUT:
              title = "Location request timed out";
              description = "The location request took too long. Please try again.";
              break;
            default:
              description = error.message;
          }

          toast({ 
            title, 
            description,
            variant: "destructive",
            duration: 6000
          });
          setLoading(false);
        },
        { 
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    } else {
      toast({ 
        title: "Geolocation not supported", 
        description: "Your browser does not support location services.",
        variant: "destructive" 
      });
    }
  };

  const handleCheckIn = async () => {
    if (!currentLocation) {
      toast({ title: "Please get your current location first", variant: "destructive" });
      return;
    }

    if (distance !== null && distance > appointment.gps_check_in_radius) {
      toast({ 
        title: "Too far from job site", 
        description: `You must be within ${appointment.gps_check_in_radius}m of the job site to check in. You are ${distance}m away.`,
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          check_in_time: new Date().toISOString(),
          check_in_lat: currentLocation.lat,
          check_in_lng: currentLocation.lng,
          status: "checked_in",
        })
        .eq("id", appointment.id);

      if (error) throw error;

      toast({ 
        title: "Checked in successfully",
        description: "Your location has been recorded."
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Error checking in", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          check_out_time: new Date().toISOString(),
          status: "completed",
        })
        .eq("id", appointment.id);

      if (error) throw error;

      toast({ 
        title: "Checked out successfully",
        description: "Appointment marked as completed."
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Error checking out", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn = !!appointment.check_in_time;
  const isWithinRadius = distance !== null && distance <= appointment.gps_check_in_radius;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {isCheckedIn ? "Check Out" : "Check In"}
          </DialogTitle>
          <DialogDescription>
            {isCheckedIn 
              ? "Complete your appointment and check out" 
              : "Verify your location to check in to this appointment"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Appointment Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h4 className="font-semibold">{appointment.title}</h4>
            {appointment.location_address && (
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {appointment.location_address}
              </p>
            )}
          </div>

          {!isCheckedIn && (
            <>
              {/* Location Status */}
              {currentLocation && distance !== null && (
                <div className="p-4 border border-border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Distance from job site:</span>
                    <Badge 
                      variant={isWithinRadius ? "default" : "destructive"}
                      className="gap-1"
                    >
                      {isWithinRadius ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {distance}m
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Required radius:</span>
                    <span className="text-sm">{appointment.gps_check_in_radius}m</span>
                  </div>
                  {!isWithinRadius && (
                    <p className="text-xs text-destructive">
                      You must be within {appointment.gps_check_in_radius}m to check in
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  onClick={handleGetLocation}
                  disabled={loading}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4" />
                  )}
                  {currentLocation ? "Refresh Location" : "Get Current Location"}
                </Button>

                <Button
                  onClick={handleCheckIn}
                  disabled={!currentLocation || loading}
                  className="w-full gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Check In
                </Button>
              </div>
            </>
          )}

          {isCheckedIn && (
            <div className="space-y-4">
              <div className="p-4 border border-success rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Already Checked In</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Checked in at {new Date(appointment.check_in_time).toLocaleString()}
                </p>
              </div>

              <Button
                onClick={handleCheckOut}
                disabled={loading}
                className="w-full gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Check Out & Complete
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}