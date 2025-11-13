import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, DollarSign, Briefcase, FileText, Clock } from "lucide-react";

interface WorkflowTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: any) => void;
}

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

export default function WorkflowTemplatesDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: WorkflowTemplatesDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: async () => {
      // @ts-ignore - types will be auto-generated after migration
      const { data, error } = await (supabase as any)
        .from("workflow_templates")
        .select("*")
        .eq("is_system_template", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const filteredTemplates = templates?.filter(
    (t) => selectedCategory === "all" || t.category === selectedCategory
  );

  const categories = templates
    ? Array.from(new Set(templates.map((t) => t.category)))
    : [];

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Start from a Template</DialogTitle>
          <DialogDescription>
            Choose a pre-built workflow template to get started quickly. You can customize it
            after selection.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid grid-cols-5 w-full">
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

          <ScrollArea className="h-[500px] mt-4 pr-4">
            {isLoading ? (
              <div className="text-center py-12">Loading templates...</div>
            ) : !filteredTemplates || filteredTemplates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No templates found in this category
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredTemplates.map((template) => {
                  const Icon = categoryIcons[template.category] || Zap;
                  const nodeCount = template.template_data?.nodes?.length || 0;
                  const connectionCount = template.template_data?.connections?.length || 0;

                  return (
                    <Card
                      key={template.id}
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => onSelectTemplate(template)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {getTriggerLabel(template.trigger_type)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="mb-4 min-h-[60px]">
                          {template.description}
                        </CardDescription>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <span>{nodeCount} nodes</span>
                            <span>{connectionCount} connections</span>
                          </div>
                          <Button size="sm" variant="outline">
                            Use Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            All templates can be customized after selection
          </p>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Start from Scratch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
