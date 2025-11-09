import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

interface BryntumSchedulerViewProps {
  currentDate: Date;
  appointments: any[];
  workers: any[];
  onAppointmentClick?: (appointmentId: string) => void;
  onAppointmentCreate?: (data: any) => void;
  onAppointmentUpdate?: (appointmentId: string, data: any) => void;
  onAppointmentDelete?: (appointmentId: string) => void;
}

export default function BryntumSchedulerView({
  currentDate,
  appointments,
  workers,
  onAppointmentClick,
  onAppointmentUpdate,
}: BryntumSchedulerViewProps) {
  const schedulerRef = useRef<any>(null);
  const [BryntumComponent, setBryntumComponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Dynamically import Bryntum to handle when it's not installed
    const loadBryntum = async () => {
      try {
        const module = await import("@bryntum/schedulerpro-react");
        await import("@bryntum/schedulerpro/schedulerpro.material.css");
        setBryntumComponent(() => module.BryntumSchedulerPro);
      } catch (e) {
        console.warn("Bryntum Scheduler Pro not installed yet");
      } finally {
        setIsLoading(false);
      }
    };
    loadBryntum();
  }, []);

  // Transform workers into Bryntum resources format
  const resources = workers.map((worker) => ({
    id: worker.id,
    name: `${worker.first_name} ${worker.last_name}`,
  }));

  // Transform appointments into Bryntum events format
  const events = appointments.map((apt) => {
    const assignedWorkers = apt.appointment_workers?.map((aw: any) => aw.worker_id) || [];
    if (apt.assigned_to && !assignedWorkers.includes(apt.assigned_to)) {
      assignedWorkers.push(apt.assigned_to);
    }

    return {
      id: apt.id,
      name: apt.title || "Untitled Appointment",
      startDate: new Date(apt.start_time),
      endDate: new Date(apt.end_time),
      resourceId: assignedWorkers[0] || null, // Primary worker
      eventColor: getStatusColor(apt.status),
      eventStyle: apt.status === "draft" ? "dashed" : "solid",
      draggable: true,
      resizable: true,
      // Store original data for reference
      originalData: apt,
    };
  });

  const schedulerConfig = {
    startDate: currentDate,
    endDate: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week view
    viewPreset: "hourAndDay",
    rowHeight: 60,
    barMargin: 5,
    
    columns: [
      {
        type: "resourceInfo",
        text: "Worker",
        width: 200,
        showEventCount: true,
        showRole: false,
      },
    ],

    features: {
      eventDrag: {
        constrainDragToResource: false, // Allow moving between resources
      },
      eventResize: true,
      eventEdit: {
        editorConfig: {
          title: "Edit Appointment",
        },
        items: {
          nameField: {
            label: "Title",
            weight: 100,
          },
          resourceField: {
            label: "Worker",
            weight: 200,
          },
          startDateField: {
            label: "Start",
            weight: 300,
          },
          endDateField: {
            label: "End",
            weight: 400,
          },
        },
      },
      timeRanges: {
        showCurrentTimeLine: true,
      },
      eventTooltip: {
        template: (data: any) => {
          const event = data.eventRecord;
          const apt = event.originalData;
          return `
            <div class="p-2">
              <div class="font-semibold">${event.name}</div>
              ${apt.service_orders ? `<div class="text-sm">Order: ${apt.service_orders.order_number}</div>` : ""}
              <div class="text-sm">${format(event.startDate, "MMM d, h:mm a")} - ${format(event.endDate, "h:mm a")}</div>
              <div class="text-sm">Status: ${apt.status}</div>
            </div>
          `;
        },
      },
    },

    // Event listeners
    listeners: {
      eventClick: ({ eventRecord }: any) => {
        if (onAppointmentClick && eventRecord.originalData) {
          onAppointmentClick(eventRecord.originalData.id);
        }
      },
      
      eventDrop: async ({ eventRecords, targetResourceRecord }: any) => {
        const event = eventRecords[0];
        if (onAppointmentUpdate && event.originalData) {
          try {
            await onAppointmentUpdate(event.originalData.id, {
              start_time: event.startDate,
              end_time: event.endDate,
              assigned_to: targetResourceRecord.id,
            });
            toast.success("Appointment updated");
          } catch (error) {
            toast.error("Failed to update appointment");
            // Revert the change
            schedulerRef.current?.instance?.project?.commitAsync();
          }
        }
      },

      eventResizeEnd: async ({ eventRecord }: any) => {
        if (onAppointmentUpdate && eventRecord.originalData) {
          try {
            await onAppointmentUpdate(eventRecord.originalData.id, {
              start_time: eventRecord.startDate,
              end_time: eventRecord.endDate,
            });
            toast.success("Appointment resized");
          } catch (error) {
            toast.error("Failed to resize appointment");
            schedulerRef.current?.instance?.project?.commitAsync();
          }
        }
      },

      scheduleClick: ({ date, resourceRecord }: any) => {
        // Clicking empty slots could open the appointment dialog in the future
        console.log("Schedule clicked:", date, resourceRecord);
      },
    },
  };

  useEffect(() => {
    // Update scheduler date when currentDate changes
    if (schedulerRef.current?.instance) {
      schedulerRef.current.instance.setTimeSpan(
        currentDate,
        new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000)
      );
    }
  }, [currentDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <p className="text-muted-foreground">Loading Bryntum Scheduler...</p>
        </div>
      </div>
    );
  }

  if (!BryntumComponent) {
    return (
      <div className="flex items-center justify-center p-12 border-2 border-dashed border-border rounded-lg">
        <div className="text-center space-y-4 max-w-2xl">
          <h3 className="text-lg font-semibold">Bryntum Scheduler Pro Not Installed</h3>
          <p className="text-sm text-muted-foreground">
            Please install the Bryntum Scheduler Pro trial package using the commands below:
          </p>
          <pre className="text-xs bg-muted p-4 rounded-md text-left overflow-x-auto">
            npm config set "@bryntum:registry=https://npm.bryntum.com"{"\n"}
            npm login --registry=https://npm.bryntum.com{"\n"}
            npm install @bryntum/schedulerpro@npm:@bryntum/schedulerpro-trial{"\n"}
            npm install @bryntum/schedulerpro-react
          </pre>
          <p className="text-xs text-muted-foreground">
            After installation, refresh the page to see the Bryntum Scheduler.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bryntum-scheduler-wrapper" style={{ height: "calc(100vh - 300px)" }}>
      <BryntumComponent
        ref={schedulerRef}
        resources={resources}
        events={events}
        {...schedulerConfig}
      />
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "gray",
    scheduled: "blue",
    in_progress: "orange",
    checked_in: "green",
    completed: "teal",
    cancelled: "red",
    published: "purple",
  };
  return colors[status] || "blue";
}
