import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Card } from "@/components/ui/card";
import { 
  FileText, 
  Mail, 
  User, 
  CheckSquare, 
  Clock, 
  GitBranch 
} from "lucide-react";

interface ActionNodeProps {
  data: {
    label: string;
    actionType?: string;
    config?: any;
  };
}

const getIcon = (actionType?: string) => {
  switch (actionType) {
    case "create_project":
    case "create_service_order":
    case "create_invoice":
      return FileText;
    case "send_email":
    case "send_helpdesk_email":
      return Mail;
    case "assign_user":
    case "assign_ticket":
      return User;
    case "create_task":
    case "create_checklist":
    case "create_note":
      return CheckSquare;
    case "delay":
      return Clock;
    case "update_status":
    case "update_ticket_status":
      return GitBranch;
    default:
      return FileText;
  }
};

const getLabel = (actionType?: string, config?: any) => {
  switch (actionType) {
    case "create_project":
      return config?.name || "Create Project";
    case "create_service_order":
      return config?.name || "Create Service Order";
    case "create_invoice":
      return config?.name || "Create Invoice";
    case "create_task":
      return config?.title || "Create Task";
    case "create_checklist":
      return config?.title || "Create Checklist";
    case "create_note":
      return "Create Note";
    case "assign_user":
      return "Assign User";
    case "assign_ticket":
      return "Assign Ticket";
    case "send_email":
      return "Send Email";
    case "send_helpdesk_email":
      return "Send Helpdesk Email";
    case "delay":
      return `Delay ${config?.duration || "?"} ${config?.unit || "minutes"}`;
    case "update_status":
      return "Update Status";
    case "update_ticket_status":
      return config?.newStatus ? `Update to ${config.newStatus}` : "Update Ticket Status";
    default:
      return actionType || "Action";
  }
};

function ActionNode({ data }: ActionNodeProps) {
  const Icon = getIcon(data.actionType);
  const label = getLabel(data.actionType, data.config);

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-muted-foreground"
      />
      <Card className="p-4 min-w-[200px] border-2 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="font-semibold text-xs text-muted-foreground uppercase">ACTION</div>
        </div>
        <div className="text-sm font-medium">{label}</div>
        {data.config && Object.keys(data.config).length > 0 && (
          <div className="text-xs text-muted-foreground mt-2">
            {Object.keys(data.config).length} setting(s) configured
          </div>
        )}
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-muted-foreground"
      />
    </>
  );
}

export default memo(ActionNode);
