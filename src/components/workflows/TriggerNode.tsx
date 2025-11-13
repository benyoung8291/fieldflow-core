import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";

interface TriggerNodeProps {
  data: {
    label: string;
    triggerType?: string;
  };
}

function TriggerNode({ data }: TriggerNodeProps) {
  return (
    <Card className="p-4 min-w-[200px] border-2 border-primary shadow-lg cursor-pointer hover:shadow-xl transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="h-5 w-5 text-primary" />
        <div className="font-semibold text-sm">TRIGGER</div>
      </div>
      <div className="text-sm">{data.label}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-primary"
      />
    </Card>
  );
}

export default memo(TriggerNode);
