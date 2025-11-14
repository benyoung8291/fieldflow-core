import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Card } from "@/components/ui/card";
import { Zap, Settings } from "lucide-react";

interface TriggerNodeProps {
  data: {
    label: string;
    triggerType?: string;
    onTriggerClick?: () => void;
  };
}

function TriggerNode({ data }: TriggerNodeProps) {
  return (
    <Card 
      className="p-4 min-w-[250px] border-2 border-primary shadow-lg cursor-pointer hover:shadow-xl hover:border-primary/80 transition-all group"
      onClick={data.onTriggerClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <div className="font-semibold text-sm">TRIGGER</div>
        </div>
        <Settings className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="text-sm font-medium">{data.label}</div>
      <div className="text-xs text-muted-foreground mt-1">
        Click to change trigger
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-primary"
      />
    </Card>
  );
}

export default memo(TriggerNode);
