import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Clock, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WorkflowTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string | null;
  triggerType: string;
}

interface TestExecutionStep {
  nodeId: string;
  nodeType: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
  result?: any;
  error?: string;
  duration?: number;
}

export default function WorkflowTestDialog({ 
  open, 
  onOpenChange, 
  workflowId,
  triggerType 
}: WorkflowTestDialogProps) {
  const [testData, setTestData] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<TestExecutionStep[]>([]);
  const [executionId, setExecutionId] = useState<string | null>(null);

  const getTriggerFields = () => {
    switch (triggerType) {
      case "quote_approved":
      case "quote_created":
      case "quote_sent":
        return [
          { key: "quote_id", label: "Quote ID", type: "text", placeholder: "Enter quote UUID" },
          { key: "customer_name", label: "Customer Name", type: "text", placeholder: "Test Customer" },
          { key: "total", label: "Total Amount", type: "number", placeholder: "1000" },
        ];
      case "invoice_sent":
        return [
          { key: "invoice_id", label: "Invoice ID", type: "text", placeholder: "Enter invoice UUID" },
          { key: "customer_name", label: "Customer Name", type: "text", placeholder: "Test Customer" },
          { key: "amount", label: "Amount", type: "number", placeholder: "500" },
        ];
      case "service_order_completed":
        return [
          { key: "service_order_id", label: "Service Order ID", type: "text", placeholder: "Enter service order UUID" },
          { key: "customer_name", label: "Customer Name", type: "text", placeholder: "Test Customer" },
          { key: "status", label: "Status", type: "text", placeholder: "completed" },
        ];
      case "project_created":
        return [
          { key: "project_id", label: "Project ID", type: "text", placeholder: "Enter project UUID" },
          { key: "project_name", label: "Project Name", type: "text", placeholder: "Test Project" },
          { key: "budget", label: "Budget", type: "number", placeholder: "10000" },
        ];
      default:
        return [
          { key: "id", label: "Record ID", type: "text", placeholder: "Enter record UUID" },
        ];
    }
  };

  const handleTestRun = async () => {
    if (!workflowId) {
      toast.error("No workflow selected");
      return;
    }

    setIsExecuting(true);
    setExecutionSteps([]);
    setExecutionId(null);

    try {
      // Call the execute-workflow edge function in test mode
      const { data, error } = await supabase.functions.invoke("execute-workflow", {
        body: {
          workflowId,
          triggerData: testData,
          testMode: true,
        },
      });

      if (error) throw error;

      if (data.executionId) {
        setExecutionId(data.executionId);
        // Poll for execution updates
        pollExecutionStatus(data.executionId);
      } else {
        toast.error("Failed to start test execution");
        setIsExecuting(false);
      }
    } catch (error: any) {
      console.error("Test execution error:", error);
      toast.error(error.message || "Failed to execute test");
      setIsExecuting(false);
    }
  };

  const pollExecutionStatus = async (execId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        // Fetch execution logs
        // @ts-ignore - workflow tables not in types yet
        const { data: logs, error } = await (supabase as any)
          .from("workflow_execution_logs")
          .select("*")
          .eq("execution_id", execId)
          .order("created_at", { ascending: true });

        if (error) throw error;

        // Convert logs to steps
        const steps: TestExecutionStep[] = (logs || []).map((log: any) => ({
          nodeId: log.node_id,
          nodeType: log.node_type,
          label: log.node_label || log.node_type,
          status: log.status === "completed" ? "success" : log.status === "failed" ? "error" : "running",
          result: log.result,
          error: log.error_message,
          duration: log.execution_time,
        }));

        setExecutionSteps(steps);

        // Check if execution is complete
        // @ts-ignore - workflow tables not in types yet
        const { data: execution } = await (supabase as any)
          .from("workflow_executions")
          .select("status")
          .eq("id", execId)
          .single();

        if (execution?.status === "completed" || execution?.status === "failed") {
          setIsExecuting(false);
          toast.success(
            execution.status === "completed" 
              ? "Test execution completed successfully" 
              : "Test execution failed"
          );
          return;
        }

        // Continue polling
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          setIsExecuting(false);
          toast.error("Test execution timeout");
        }
      } catch (error) {
        console.error("Polling error:", error);
        setIsExecuting(false);
      }
    };

    poll();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Workflow Execution</DialogTitle>
          <DialogDescription>
            Simulate workflow execution with test data to verify it works correctly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-3">Trigger Data</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Provide sample data for the trigger: <Badge variant="secondary">{triggerType}</Badge>
              </p>
            </div>

            {getTriggerFields().map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={testData[field.key] || ""}
                  onChange={(e) => setTestData({ ...testData, [field.key]: e.target.value })}
                  disabled={isExecuting}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label>Additional Context (JSON)</Label>
              <Textarea
                placeholder='{"key": "value"}'
                value={testData.context ? JSON.stringify(testData.context, null, 2) : ""}
                onChange={(e) => {
                  try {
                    const context = JSON.parse(e.target.value);
                    setTestData({ ...testData, context });
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                rows={4}
                disabled={isExecuting}
              />
            </div>
          </div>

          {executionSteps.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold">Execution Steps</h4>
              <div className="space-y-2">
                {executionSteps.map((step, idx) => (
                  <Card key={`${step.nodeId}-${idx}`} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getStatusIcon(step.status)}</div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{step.label}</div>
                          <Badge variant="outline" className="text-xs">
                            {step.nodeType}
                          </Badge>
                        </div>
                        
                        {step.error && (
                          <Alert variant="destructive">
                            <AlertDescription className="text-sm">{step.error}</AlertDescription>
                          </Alert>
                        )}
                        
                        {step.result && step.status === "success" && (
                          <div className="text-sm text-muted-foreground">
                            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                              {JSON.stringify(step.result, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {step.duration && (
                          <div className="text-xs text-muted-foreground">
                            Completed in {step.duration}ms
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExecuting}>
              Close
            </Button>
            <Button onClick={handleTestRun} disabled={isExecuting}>
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
