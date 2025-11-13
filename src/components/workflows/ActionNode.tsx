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
      return Mail;
    case "assign_user":
      return User;
    case "create_task":
      return CheckSquare;
    case "delay":
      return Clock;
    case "update_status":
      return GitBranch;
    default:
      return FileText;
  }
};

function ActionNode({ data }: ActionNodeProps) {
  const Icon = getIcon(data.actionType);

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
        <div className="text-sm font-medium">{data.label}</div>
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
