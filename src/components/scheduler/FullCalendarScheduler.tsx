import { useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format } from "date-fns";
import { toast } from "sonner";

interface FullCalendarSchedulerProps {
  currentDate: Date;
  appointments: any[];
  workers: any[];
  onAppointmentClick?: (appointmentId: string) => void;
  onAppointmentUpdate?: (appointmentId: string, data: any) => Promise<void>;
  onDateChange?: (date: Date) => void;
}

export default function FullCalendarScheduler({
  currentDate,
  appointments,
  workers,
  onAppointmentClick,
  onAppointmentUpdate,
  onDateChange,
}: FullCalendarSchedulerProps) {
  const calendarRef = useRef<FullCalendar>(null);

  // Transform workers into FullCalendar resources
  const resources = [
    {
      id: "unassigned",
      title: "Unassigned",
      eventColor: "hsl(var(--muted))",
    },
    ...workers.map((worker) => ({
      id: worker.id,
      title: `${worker.first_name} ${worker.last_name}`,
      eventColor: "hsl(var(--primary))",
    })),
  ];

  // Transform appointments into FullCalendar events
  const events = appointments.map((apt) => {
    const assignedWorkers = apt.appointment_workers?.map((aw: any) => aw.worker_id) || [];
    if (apt.assigned_to && !assignedWorkers.includes(apt.assigned_to)) {
      assignedWorkers.push(apt.assigned_to);
    }

    return {
      id: apt.id,
      resourceId: assignedWorkers[0] || "unassigned",
      title: apt.title || "Untitled",
      start: apt.start_time,
      end: apt.end_time,
      backgroundColor: getStatusColor(apt.status),
      borderColor: getStatusColor(apt.status),
      textColor: "hsl(var(--primary-foreground))",
      extendedProps: {
        status: apt.status,
        serviceOrder: apt.service_orders?.order_number,
        description: apt.description,
        location: apt.location_address,
        originalData: apt,
      },
    };
  });

  useEffect(() => {
    // Update calendar date when currentDate changes
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(currentDate);
    }
  }, [currentDate]);

  const handleEventClick = (info: any) => {
    if (onAppointmentClick) {
      onAppointmentClick(info.event.id);
    }
  };

  const handleEventDrop = async (info: any) => {
    const { event } = info;
    
    if (onAppointmentUpdate) {
      try {
        await onAppointmentUpdate(event.id, {
          start_time: event.start,
          end_time: event.end,
          assigned_to: event.getResources()[0]?.id !== "unassigned" 
            ? event.getResources()[0]?.id 
            : null,
        });
        toast.success("Appointment updated");
      } catch (error) {
        info.revert();
        toast.error("Failed to update appointment");
      }
    }
  };

  const handleEventResize = async (info: any) => {
    const { event } = info;
    
    if (onAppointmentUpdate) {
      try {
        await onAppointmentUpdate(event.id, {
          start_time: event.start,
          end_time: event.end,
        });
        toast.success("Appointment resized");
      } catch (error) {
        info.revert();
        toast.error("Failed to resize appointment");
      }
    }
  };

  const handleDatesSet = (dateInfo: any) => {
    if (onDateChange) {
      onDateChange(dateInfo.start);
    }
  };

  return (
    <div className="fullcalendar-scheduler">
      <style>{`
        .fullcalendar-scheduler {
          --fc-border-color: hsl(var(--border));
          --fc-button-bg-color: hsl(var(--primary));
          --fc-button-border-color: hsl(var(--primary));
          --fc-button-hover-bg-color: hsl(var(--primary) / 0.9);
          --fc-button-hover-border-color: hsl(var(--primary) / 0.9);
          --fc-button-active-bg-color: hsl(var(--primary));
          --fc-button-active-border-color: hsl(var(--primary));
          --fc-today-bg-color: hsl(var(--accent) / 0.3);
        }
        
        .fc {
          font-family: inherit;
          background: hsl(var(--background));
        }
        
        .fc .fc-button {
          text-transform: capitalize;
          font-weight: 500;
          border-radius: 0.5rem;
          padding: 0.5rem 1rem;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px 0 hsl(var(--primary) / 0.05);
        }
        
        .fc .fc-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px hsl(var(--primary) / 0.15);
        }
        
        .fc .fc-button:focus {
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.2);
          outline: none;
        }
        
        .fc .fc-button-active {
          box-shadow: inset 0 2px 4px 0 hsl(var(--primary) / 0.2);
        }
        
        .fc-event {
          border-radius: 0.375rem;
          padding: 4px 6px;
          cursor: move;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          border-width: 1px;
          border-style: solid;
        }
        
        .fc-event:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          z-index: 10;
        }
        
        .fc-event-dragging {
          opacity: 0.7;
          transform: scale(1.02);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
        }
        
        .fc-event-resizing {
          opacity: 0.8;
        }
        
        .fc-resource-timeline-divider {
          width: 2px;
          background: hsl(var(--border));
        }
        
        .fc-timeline-slot {
          border-right: 1px solid hsl(var(--border) / 0.5);
          transition: background-color 0.2s ease;
        }
        
        .fc-timeline-slot:hover {
          background-color: hsl(var(--accent) / 0.1);
        }
        
        .fc-timeline-slot-minor {
          border-right-style: dotted;
        }
        
        .fc-col-header-cell {
          background: hsl(var(--muted) / 0.7);
          font-weight: 600;
          border-bottom: 2px solid hsl(var(--border));
          padding: 8px;
        }
        
        .fc-datagrid-cell {
          padding: 8px;
        }
        
        .fc-datagrid-cell-frame {
          background: hsl(var(--muted) / 0.3);
          transition: background-color 0.2s ease;
        }
        
        .fc-datagrid-cell-frame:hover {
          background: hsl(var(--muted) / 0.5);
        }
        
        .fc-timeline-now-indicator-line {
          border-color: hsl(var(--destructive));
          border-width: 2px;
        }
        
        .fc-timeline-now-indicator-arrow {
          border-top-color: hsl(var(--destructive));
        }
        
        .fc-scrollgrid {
          border-color: hsl(var(--border));
        }
        
        .fc-highlight {
          background: hsl(var(--primary) / 0.1);
        }
      `}</style>
      
      <FullCalendar
        ref={calendarRef}
        plugins={[
          resourceTimelinePlugin,
          dayGridPlugin,
          timeGridPlugin,
          interactionPlugin,
        ]}
        initialView="resourceTimelineWeek"
        initialDate={currentDate}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth",
        }}
        views={{
          resourceTimelineDay: {
            buttonText: "Day",
            slotDuration: "01:00:00",
            slotLabelInterval: "01:00:00",
          },
          resourceTimelineWeek: {
            buttonText: "Week",
            slotDuration: "06:00:00",
            slotLabelInterval: "1 day",
          },
          resourceTimelineMonth: {
            buttonText: "Month",
            slotDuration: "1 day",
            slotLabelInterval: "1 day",
          },
        }}
        resources={resources}
        events={events}
        editable={true}
        droppable={true}
        eventResizableFromStart={true}
        eventDurationEditable={true}
        eventResourceEditable={true}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        datesSet={handleDatesSet}
        height="auto"
        slotMinWidth={50}
        resourceAreaWidth="200px"
        resourceAreaHeaderContent="Workers"
        nowIndicator={true}
        eventContent={(arg) => (
          <div className="flex flex-col overflow-hidden px-1.5 py-0.5 h-full justify-center">
            <div className="font-semibold text-xs truncate leading-tight">{arg.event.title}</div>
            {arg.event.extendedProps.serviceOrder && (
              <div className="text-[10px] opacity-80 truncate font-medium">
                SO #{arg.event.extendedProps.serviceOrder}
              </div>
            )}
            <div className="text-[10px] opacity-70 font-medium">
              {format(arg.event.start!, "h:mm a")} - {format(arg.event.end!, "h:mm a")}
            </div>
          </div>
        )}
      />
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "hsl(var(--muted-foreground))",
    published: "hsl(var(--info))",
    scheduled: "hsl(var(--info))",
    in_progress: "hsl(var(--warning))",
    checked_in: "hsl(var(--warning))",
    completed: "hsl(var(--success))",
    cancelled: "hsl(var(--destructive))",
  };
  return colors[status] || "hsl(var(--primary))";
}
