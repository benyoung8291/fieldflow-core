import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { Calendar, Clock, MapPin, User, Users, FileText, Repeat, Edit, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface AppointmentDetailsDialogProps {
  appointment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete?: () => void;
}

export default function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: AppointmentDetailsDialogProps) {
  if (!appointment) return null;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">
                {appointment.title}
              </DialogTitle>
              <Badge className={getStatusColor(appointment.status)}>
                {getStatusLabel(appointment.status)}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              {onDelete && (
                <Button variant="outline" size="sm" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-1 text-destructive" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Date:</span>
              <span>{format(startTime, "EEEE, MMMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Time:</span>
              <span>
                {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                <span className="text-muted-foreground ml-2">
                  ({hours}h {minutes > 0 ? `${minutes}m` : ''})
                </span>
              </span>
            </div>
            {(appointment.is_recurring || appointment.parent_appointment_id) && (
              <div className="flex items-center gap-2 text-sm">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Recurring</span>
                {appointment.recurrence_pattern && (
                  <Badge variant="outline" className="text-xs">
                    {appointment.recurrence_pattern}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Workers */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                Assigned Workers ({workers.length})
              </span>
            </div>
            {workers.length > 0 ? (
              <div className="space-y-2">
                {workers.map((worker: any) => (
                  <div key={worker.worker_id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {worker.profiles?.first_name?.[0]}{worker.profiles?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {worker.profiles?.first_name} {worker.profiles?.last_name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No workers assigned</p>
            )}
          </div>

          {/* Location */}
          {appointment.location_address && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Location</span>
                </div>
                <p className="text-sm pl-6">{appointment.location_address}</p>
                {appointment.check_in_time && (
                  <p className="text-sm text-muted-foreground pl-6 mt-1">
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
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Service Order</span>
                </div>
                <div className="pl-6">
                  <Badge variant="outline">{appointment.service_orders.order_number}</Badge>
                  {appointment.service_orders.title && (
                    <p className="text-sm mt-1">{appointment.service_orders.title}</p>
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
                <span className="font-medium text-sm block mb-2">Description</span>
                <p className="text-sm text-muted-foreground">{appointment.description}</p>
              </div>
            </>
          )}

          {/* Notes */}
          {appointment.notes && (
            <>
              <Separator />
              <div>
                <span className="font-medium text-sm block mb-2">Notes</span>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
