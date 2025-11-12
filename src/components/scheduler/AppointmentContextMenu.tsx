import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Trash2 } from "lucide-react";

interface AppointmentContextMenuProps {
  children: React.ReactNode;
  appointment: any;
  onDelete?: () => void;
}

export default function AppointmentContextMenu({
  children,
  appointment,
  onDelete,
}: AppointmentContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onDelete && (
          <ContextMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Appointment
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
