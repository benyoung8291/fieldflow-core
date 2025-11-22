import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TimesheetMapViewProps {
  timeLog: any;
}

export default function TimesheetMapView({ timeLog }: TimesheetMapViewProps) {
  const [open, setOpen] = useState(false);
  
  const hasAppointmentLocation = timeLog.appointments?.location_lat && timeLog.appointments?.location_lng;
  const hasCheckInLocation = timeLog.check_in_lat && timeLog.check_in_lng;
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
      timeLog.check_in_lat,
      timeLog.check_in_lng
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
    if (distance <= 100) return "text-success";
    if (distance <= 500) return "text-warning";
    return "text-destructive";
  };

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
                    Lat: {timeLog.check_in_lat.toFixed(6)}<br />
                    Lng: {timeLog.check_in_lng.toFixed(6)}
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

          <div className="border rounded-lg overflow-hidden h-[500px]">
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBmJ3nHV0wshsuHZkP3UBrMNDq5HT1Xvlk'}&q=${hasAppointmentLocation ? `${timeLog.appointments.location_lat},${timeLog.appointments.location_lng}` : `${hasCheckInLocation ? `${timeLog.check_in_lat},${timeLog.check_in_lng}` : '0,0'}`}&zoom=16`}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
