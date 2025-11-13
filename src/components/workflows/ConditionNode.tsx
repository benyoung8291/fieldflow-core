import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Card } from "@/components/ui/card";
import { GitBranch } from "lucide-react";

interface ConditionNodeProps {
  data: {
    label: string;
    condition?: string;
  };
}

function ConditionNode({ data }: ConditionNodeProps) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-muted-foreground"
      />
      <Card className="p-4 min-w-[200px] border-2 border-yellow-500 shadow-md cursor-pointer hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="h-4 w-4 text-yellow-600" />
          <div className="font-semibold text-xs text-yellow-600 uppercase">CONDITION</div>
        </div>
        <div className="text-sm">{data.label}</div>
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="w-3 h-3 !bg-green-500 !left-[25%]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="w-3 h-3 !bg-red-500 !left-[75%]"
      />
    </>
  );
}

export default memo(ConditionNode);
