import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Save, 
  Play, 
  Plus,
  FileText,
  Mail,
  User,
  CheckSquare,
  Clock,
  GitBranch,
  Zap,
  ArrowLeft
} from "lucide-react";
import TriggerNode from "@/components/workflows/TriggerNode";
import ActionNode from "@/components/workflows/ActionNode";
import ConditionNode from "@/components/workflows/ConditionNode";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

const actionTypes = [
  { value: "create_project", label: "Create Project", icon: FileText },
  { value: "create_service_order", label: "Create Service Order", icon: FileText },
  { value: "create_invoice", label: "Create Invoice", icon: FileText },
  { value: "create_task", label: "Create Task", icon: CheckSquare },
  { value: "update_status", label: "Update Status", icon: GitBranch },
  { value: "send_email", label: "Send Email", icon: Mail },
  { value: "assign_user", label: "Assign User", icon: User },
  { value: "delay", label: "Delay", icon: Clock },
];

import WorkflowExecutionsList from "@/components/workflows/WorkflowExecutionsList";
import QuickStartPanel from "@/components/workflows/QuickStartPanel";

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [triggerType, setTriggerType] = useState("quote_approved");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showQuickStart, setShowQuickStart] = useState(true);

  const { data: workflow, isLoading } = useQuery({
    queryKey: ["workflow", id],
    queryFn: async () => {
      if (!id || id === "new") return null;
      
      // @ts-ignore - types will be auto-generated after migration
      const { data, error} = await (supabase as any)
        .from("workflows")
        .select(`
          *,
          workflow_nodes(*),
          workflow_connections(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!id && id !== "new",
  });

  useEffect(() => {
    if (workflow) {
      setWorkflowName(workflow.name);
      setWorkflowDescription(workflow.description || "");
      setTriggerType(workflow.trigger_type);

      const loadedNodes: Node[] = workflow.workflow_nodes?.map((node: any) => ({
        id: node.node_id,
        type: node.node_type,
        position: { x: node.position_x, y: node.position_y },
        data: {
          label: node.action_type || node.node_type,
          actionType: node.action_type,
          config: node.config,
        },
      })) || [];

      const loadedEdges: Edge[] = workflow.workflow_connections?.map((conn: any, idx: number) => ({
        id: `e${conn.source_node_id}-${conn.target_node_id}-${idx}`,
        source: conn.source_node_id,
        target: conn.target_node_id,
        sourceHandle: conn.source_handle,
        targetHandle: conn.target_handle,
        label: conn.label,
      })) || [];

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setShowQuickStart(false);
    } else if (id === "new") {
      // Show quick start for new workflows
      setShowQuickStart(true);
    }
  }, [workflow, id, setNodes, setEdges]);

  const handleTemplateSelection = (template: any) => {
    if (!template) {
      // User chose to start from scratch
      setNodes([
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 250, y: 50 },
          data: { label: "When Quote Approved", triggerType: "quote_approved" },
        },
      ]);
      setEdges([]);
      setShowQuickStart(false);
      return;
    }

    // Load template data
    setWorkflowName(template.name);
    setWorkflowDescription(template.description || "");
    setTriggerType(template.trigger_type);

    const templateNodes: Node[] = template.template_data.nodes.map((node: any) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    }));

    const templateEdges: Edge[] = template.template_data.connections.map((conn: any) => ({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      sourceHandle: conn.sourceHandle,
      targetHandle: conn.targetHandle,
      label: conn.label,
    }));

    setNodes(templateNodes);
    setEdges(templateEdges);
    setShowQuickStart(false);
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (actionType: string) => {
    const newNode: Node = {
      id: `${actionType}-${Date.now()}`,
      type: "action",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 200 },
      data: { 
        label: actionTypes.find(t => t.value === actionType)?.label || actionType,
        actionType,
        config: {}
      },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      let workflowId = id;

      if (!id || id === "new") {
        // @ts-ignore - types will be auto-generated after migration
        const { data: newWorkflow, error: workflowError } = await (supabase as any)
          .from("workflows")
          .insert({
            tenant_id: profile.tenant_id,
            name: workflowName,
            description: workflowDescription,
            trigger_type: triggerType,
            created_by: user.id,
          })
          .select()
          .single();

        if (workflowError) throw workflowError;
        workflowId = (newWorkflow as any).id;
      } else {
        // @ts-ignore - types will be auto-generated after migration
        const { error: updateError } = await (supabase as any)
          .from("workflows")
          .update({
            name: workflowName,
            description: workflowDescription,
            trigger_type: triggerType,
          })
          .eq("id", workflowId);

        if (updateError) throw updateError;

        // Delete existing nodes and connections
        // @ts-ignore - types will be auto-generated after migration
        await (supabase as any).from("workflow_nodes").delete().eq("workflow_id", workflowId);
        // @ts-ignore - types will be auto-generated after migration
        await (supabase as any).from("workflow_connections").delete().eq("workflow_id", workflowId);
      }

      // Insert nodes
      const nodesToInsert = nodes.map((node) => ({
        workflow_id: workflowId,
        node_id: node.id,
        node_type: node.type || "action",
        action_type: node.data.actionType,
        config: node.data.config || {},
        position_x: node.position.x,
        position_y: node.position.y,
      }));

      if (nodesToInsert.length > 0) {
        // @ts-ignore - types will be auto-generated after migration
        const { error: nodesError } = await (supabase as any)
          .from("workflow_nodes")
          .insert(nodesToInsert as any);

        if (nodesError) throw nodesError;
      }

      // Insert connections
      const connectionsToInsert = edges.map((edge) => ({
        workflow_id: workflowId,
        source_node_id: edge.source,
        target_node_id: edge.target,
        source_handle: edge.sourceHandle || null,
        target_handle: edge.targetHandle || null,
        label: edge.label as string || null,
      }));

      if (connectionsToInsert.length > 0) {
        // @ts-ignore - types will be auto-generated after migration
        const { error: connectionsError } = await (supabase as any)
          .from("workflow_connections")
          .insert(connectionsToInsert as any);

        if (connectionsError) throw connectionsError;
      }

      return workflowId;
    },
    onSuccess: (workflowId) => {
      toast.success("Workflow saved successfully");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      if (id === "new") {
        navigate(`/workflows/${workflowId}`);
      }
    },
    onError: (error) => {
      toast.error("Failed to save workflow");
      console.error(error);
    },
  });

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      {showQuickStart ? (
        <QuickStartPanel onSelectTemplate={handleTemplateSelection} />
      ) : (
        <>
          <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/workflows")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex-1">
              <Input
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Workflow Name"
                className="text-lg font-semibold"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button variant="outline">
              <Play className="h-4 w-4 mr-2" />
              Test Run
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Trigger</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote_created">Quote Created</SelectItem>
                <SelectItem value="quote_approved">Quote Approved</SelectItem>
                <SelectItem value="quote_sent">Quote Sent</SelectItem>
                <SelectItem value="invoice_sent">Invoice Sent</SelectItem>
                <SelectItem value="service_order_completed">Service Order Completed</SelectItem>
                <SelectItem value="project_created">Project Created</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              rows={1}
            />
          </div>
        </div>

        {id && id !== "new" && (
          <WorkflowExecutionsList workflowId={id} />
        )}
      </div>

      <div className="flex flex-1">
        <Card className="w-64 m-4 p-4 space-y-2 overflow-y-auto">
          <h3 className="font-semibold mb-3">Add Actions</h3>
          {actionTypes.map((action) => (
            <Button
              key={action.value}
              variant="outline"
              className="w-full justify-start"
              onClick={() => addNode(action.value)}
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </Card>

        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
