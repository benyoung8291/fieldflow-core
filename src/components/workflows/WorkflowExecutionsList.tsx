import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

interface WorkflowExecutionsListProps {
  workflowId: string;
}

export default function WorkflowExecutionsList({ workflowId }: WorkflowExecutionsListProps) {
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  const { data: executions, isLoading } = useQuery({
    queryKey: ["workflow-executions", workflowId],
    queryFn: async () => {
      // @ts-ignore - types will be auto-generated after migration
      const { data, error } = await (supabase as any)
        .from("workflow_executions")
        .select("*")
        .eq("workflow_id", workflowId)
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as any[];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["workflow-execution-logs", selectedExecutionId],
    queryFn: async () => {
      if (!selectedExecutionId) return [];

      // @ts-ignore - types will be auto-generated after migration
      const { data, error } = await (supabase as any)
        .from("workflow_execution_logs")
        .select("*")
        .eq("execution_id", selectedExecutionId)
        .order("executed_at", { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedExecutionId,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      completed: "default",
      failed: "destructive",
      running: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading executions...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Workflow Executions</CardTitle>
          <CardDescription>History of workflow execution runs</CardDescription>
        </CardHeader>
        <CardContent>
          {!executions || executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No executions yet. Workflow will run when triggered.
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {executions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(execution.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(execution.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(execution.started_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        {execution.error_message && (
                          <p className="text-xs text-red-600 mt-1">{execution.error_message}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedExecutionId(execution.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Logs
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedExecutionId}
        onOpenChange={() => setSelectedExecutionId(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Execution Logs</DialogTitle>
            <DialogDescription>Detailed step-by-step execution logs</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            {logs && logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log, index) => (
                  <Card key={log.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            Step {index + 1}
                          </span>
                          <span className="text-sm font-medium">{log.node_id}</span>
                        </div>
                        {log.status === "success" ? (
                          <Badge variant="default">Success</Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {log.output && (
                        <div className="bg-muted p-3 rounded-md">
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(log.output, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.error_message && (
                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-950 rounded-md">
                          <p className="text-xs text-red-700 dark:text-red-400">
                            {log.error_message}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(log.executed_at), { addSuffix: true })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No logs available</div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
