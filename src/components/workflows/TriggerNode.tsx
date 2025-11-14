import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Zap, Settings } from "lucide-react";

interface TriggerNodeProps {
  data: {
    label: string;
    triggerType?: string;
    onTriggerClick?: () => void;
  };
}

function TriggerNode({ data }: TriggerNodeProps) {
  const getTriggerLabel = (type: string) => {
    const labels: Record<string, string> = {
      quote_created: "Quote Created",
      quote_approved: "Quote Approved",
      quote_sent: "Quote Sent",
      invoice_sent: "Invoice Sent",
      service_order_completed: "Service Order Completed",
      project_created: "Project Created",
      ticket_created: "Ticket Created",
      ticket_assigned: "Ticket Assigned",
      ticket_status_changed: "Ticket Status Changed",
      ticket_resolved: "Ticket Resolved",
      ticket_reopened: "Ticket Reopened",
      email_received: "Email Received",
      email_sent: "Email Sent",
      purchase_order_created: "Purchase Order Created",
      purchase_order_approved: "Purchase Order Approved",
      expense_submitted: "Expense Submitted",
      expense_approved: "Expense Approved",
    };
    return labels[type] || type;
  };

  return (
    <div 
      className="px-4 py-3 shadow-lg rounded-lg bg-primary text-primary-foreground border-2 border-primary min-w-[200px] cursor-pointer hover:shadow-xl transition-shadow group"
      onClick={data.onTriggerClick}
    >
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4" />
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
            Trigger
          </div>
          <div className="text-sm font-medium mt-1">
            {data.triggerType ? getTriggerLabel(data.triggerType) : "Click to select trigger"}
          </div>
        </div>
        <Settings className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary-foreground" />
    </div>
  );
}

export default memo(TriggerNode);
