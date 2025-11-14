import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SampleDataPanelProps {
  triggerType: string;
  sampleData: Record<string, any> | null;
  onLoadSample: () => void;
  isLoading?: boolean;
}

export default function SampleDataPanel({
  triggerType,
  sampleData,
  onLoadSample,
  isLoading = false,
}: SampleDataPanelProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(["root"]));

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderValue = (value: any, path: string = "root"): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">null</span>;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      const isExpanded = expandedKeys.has(path);
      return (
        <div className="space-y-1">
          <button
            onClick={() => toggleExpand(path)}
            className="flex items-center gap-1 hover:text-primary"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span className="text-xs text-muted-foreground">
              {Object.keys(value).length} fields
            </span>
          </button>
          {isExpanded && (
            <div className="ml-4 space-y-2 border-l-2 border-border pl-3">
              {Object.entries(value).map(([key, val]) => (
                <div key={key}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {key}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {typeof val}
                    </span>
                  </div>
                  <div className="ml-2 mt-1 text-sm">
                    {renderValue(val, `${path}.${key}`)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <span className="text-sm">
          Array ({value.length} items)
        </span>
      );
    }

    return (
      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
        {String(value)}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Sample Data</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={onLoadSample}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")} />
            {isLoading ? "Loading..." : "Load Sample"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!sampleData ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Click "Load Sample" to see example data from this trigger
          </div>
        ) : (
          <div className="space-y-2">
            {renderValue(sampleData)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
