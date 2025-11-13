import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, DollarSign, Briefcase, FileText, Zap, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const categoryIcons: Record<string, any> = {
  sales: DollarSign,
  billing: FileText,
  project_management: Briefcase,
  general: Zap,
};

const categoryLabels: Record<string, string> = {
  sales: "Sales",
  billing: "Billing",
  project_management: "Project Management",
  general: "General",
};

export default function WorkflowTemplateSelector() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: async () => {
      // @ts-ignore - types will be auto-generated after migration
      const { data, error } = await (supabase as any)
        .from("workflow_templates")
        .select("*")
        .eq("is_system_template", true)
        .order("category, created_at");

      if (error) throw error;
      return data as any[];
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async (template: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Create workflow from template
      // @ts-ignore - types will be auto-generated after migration
      const { data: workflow, error: workflowError } = await (supabase as any)
        .from("workflows")
        .insert({
          tenant_id: profile.tenant_id,
          name: template.name,
          description: template.description,
          trigger_type: template.trigger_type,
          is_active: false, // User can activate after customization
          created_by: user.id,
        })
        .select()
        .single();

      if (workflowError) throw workflowError;

      // Insert nodes
      const nodes = template.template_data.nodes || [];
      const nodesToInsert = nodes.map((node: any) => ({
        workflow_id: workflow.id,
        node_id: node.id,
        node_type: node.type,
        action_type: node.data.actionType,
        config: node.data.config || {},
        position_x: node.position.x,
        position_y: node.position.y,
      }));

      if (nodesToInsert.length > 0) {
        // @ts-ignore - types will be auto-generated after migration
        const { error: nodesError } = await (supabase as any)
          .from("workflow_nodes")
          .insert(nodesToInsert);

        if (nodesError) throw nodesError;
      }

      // Insert connections
      const connections = template.template_data.connections || [];
      const connectionsToInsert = connections.map((conn: any) => ({
        workflow_id: workflow.id,
        source_node_id: conn.source,
        target_node_id: conn.target,
        source_handle: conn.sourceHandle || null,
        target_handle: conn.targetHandle || null,
        label: conn.label || null,
      }));

      if (connectionsToInsert.length > 0) {
        // @ts-ignore - types will be auto-generated after migration
        const { error: connectionsError } = await (supabase as any)
          .from("workflow_connections")
          .insert(connectionsToInsert);

        if (connectionsError) throw connectionsError;
      }

      return workflow;
    },
    onSuccess: (workflow) => {
      toast.success("Workflow created from template");
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      navigate(`/workflows/${workflow.id}`);
    },
    onError: (error) => {
      toast.error("Failed to create workflow from template");
      console.error(error);
    },
  });

  const getTriggerLabel = (triggerType: string) => {
    const labels: Record<string, string> = {
      quote_created: "Quote Created",
      quote_approved: "Quote Approved",
      quote_sent: "Quote Sent",
      invoice_sent: "Invoice Sent",
      service_order_completed: "Service Order Completed",
      project_created: "Project Created",
    };
    return labels[triggerType] || triggerType;
  };

  const categories = templates
    ? Array.from(new Set(templates.map((t) => t.category)))
    : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate("/workflows")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Button>
          <h1 className="text-3xl font-bold">Choose a Workflow Template</h1>
          <p className="text-muted-foreground mt-1">
            Start with a pre-built template or create from scratch
          </p>
        </div>
        <Button onClick={() => navigate("/workflows/new")} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Start from Scratch
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading templates...</div>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Templates</TabsTrigger>
            {categories.map((category) => {
              const Icon = categoryIcons[category] || Zap;
              return (
                <TabsTrigger key={category} value={category} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {categoryLabels[category] || category}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates?.map((template) => {
                const Icon = categoryIcons[template.category] || Zap;
                const nodeCount = template.template_data?.nodes?.length || 0;

                return (
                  <Card
                    key={template.id}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-1">{template.name}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {getTriggerLabel(template.trigger_type)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <CardDescription className="min-h-[60px]">
                        {template.description}
                      </CardDescription>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{nodeCount} actions</span>
                        <Button
                          onClick={() => createFromTemplateMutation.mutate(template)}
                          disabled={createFromTemplateMutation.isPending}
                        >
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {categories.map((category) => (
            <TabsContent key={category} value={category} className="space-y-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates
                  ?.filter((t) => t.category === category)
                  .map((template) => {
                    const Icon = categoryIcons[template.category] || Zap;
                    const nodeCount = template.template_data?.nodes?.length || 0;

                    return (
                      <Card
                        key={template.id}
                        className="hover:shadow-lg transition-shadow"
                      >
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Icon className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-xl mb-1">{template.name}</CardTitle>
                              <Badge variant="outline" className="text-xs">
                                {getTriggerLabel(template.trigger_type)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <CardDescription className="min-h-[60px]">
                            {template.description}
                          </CardDescription>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {nodeCount} actions
                            </span>
                            <Button
                              onClick={() => createFromTemplateMutation.mutate(template)}
                              disabled={createFromTemplateMutation.isPending}
                            >
                              Use Template
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
