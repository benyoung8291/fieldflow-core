import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { Calendar, Clock, MapPin, Users, FileText, Repeat } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AppointmentHoverCardProps {
  appointment: any;
  children: React.ReactNode;
}

export default function AppointmentHoverCard({
  appointment,
  children,
}: AppointmentHoverCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovering(true);
    timeoutRef.current = setTimeout(() => {
      if (isHovering) {
        setShowPopup(true);
      }
    }, 2000);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    // Check if mouse is moving to the popup
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (popupRef.current?.contains(relatedTarget)) {
      return;
    }
    
    setIsHovering(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowPopup(false);
  };

  const handlePopupMouseLeave = () => {
    setIsHovering(false);
    setShowPopup(false);
  };

  if (!appointment) return <>{children}</>;

  const startTime = new Date(appointment.start_time);
  const endTime = new Date(appointment.end_time);
  const hours = differenceInHours(endTime, startTime);
  const minutes = differenceInMinutes(endTime, startTime) % 60;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-muted";
      case "published": return "bg-info";
      case "checked_in": return "bg-warning";
      case "completed": return "bg-success";
      case "cancelled": return "bg-destructive";
      default: return "bg-muted";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const workers = appointment.appointment_workers || [];

  return (
    <div 
      ref={cardRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {showPopup && (
        <div
          ref={popupRef}
          className={cn(
            "absolute left-full top-0 ml-2 z-50 w-96 animate-fade-in",
            "pointer-events-auto"
          )}
          onMouseLeave={handlePopupMouseLeave}
        >
          <Card className="shadow-lg border-2 bg-background">
            <CardContent className="p-4 space-y-4">
              {/* Header */}
              <div>
                <h3 className="font-semibold text-sm mb-2">{appointment.title}</h3>
                <Badge className={getStatusColor(appointment.status)}>
                  {getStatusLabel(appointment.status)}
                </Badge>
              </div>

              <Separator />

              {/* Date & Time */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">Date:</span>
                  <span>{format(startTime, "EEEE, MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">Time:</span>
                  <span>
                    {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                    <span className="text-muted-foreground ml-2">
                      ({hours}h {minutes > 0 ? `${minutes}m` : ''})
                    </span>
                  </span>
                </div>
                {(appointment.is_recurring || appointment.parent_appointment_id) && (
                  <div className="flex items-center gap-2 text-xs">
                    <Repeat className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">Recurring</span>
                    {appointment.recurrence_pattern && (
                      <Badge variant="outline" className="text-xs">
                        {appointment.recurrence_pattern}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Workers */}
              {workers.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-xs">
                        Assigned Workers ({workers.length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {workers.map((worker: any) => (
                        <div key={worker.worker_id} className="flex items-center gap-2 p-1 rounded-md bg-muted/50">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">
                              {worker.profiles?.first_name?.[0]}{worker.profiles?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">
                            {worker.profiles?.first_name} {worker.profiles?.last_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Location */}
              {appointment.location_address && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-xs">Location</span>
                    </div>
                    <p className="text-xs pl-5">{appointment.location_address}</p>
                    {appointment.check_in_time && (
                      <p className="text-xs text-muted-foreground pl-5 mt-1">
                        Checked in at {format(new Date(appointment.check_in_time), "h:mm a")}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Service Order */}
              {appointment.service_orders && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-xs">Service Order</span>
                    </div>
                    <div className="pl-5">
                      <Badge variant="outline" className="text-xs">{appointment.service_orders.order_number}</Badge>
                      {appointment.service_orders.title && (
                        <p className="text-xs mt-1">{appointment.service_orders.title}</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Description */}
              {appointment.description && (
                <>
                  <Separator />
                  <div>
                    <span className="font-medium text-xs block mb-1">Description</span>
                    <p className="text-xs text-muted-foreground">{appointment.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
