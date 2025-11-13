import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Rocket, Sparkles } from "lucide-react";
import WorkflowTemplatesDialog from "./WorkflowTemplatesDialog";

interface QuickStartPanelProps {
  onSelectTemplate: (template: any) => void;
}

export default function QuickStartPanel({ onSelectTemplate }: QuickStartPanelProps) {
  const [templatesOpen, setTemplatesOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit">
              <Rocket className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Build Your Workflow</CardTitle>
            <CardDescription className="text-base">
              Choose how you want to start creating your automation workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="default"
              size="lg"
              className="w-full h-auto py-6"
              onClick={() => setTemplatesOpen(true)}
            >
              <div className="flex flex-col items-center gap-2">
                <Sparkles className="h-6 w-6" />
                <div>
                  <div className="font-semibold text-lg">Start from a Template</div>
                  <div className="text-xs opacity-90">
                    Pre-built workflows ready to customize
                  </div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-6"
              onClick={() => onSelectTemplate(null)}
            >
              <div className="flex flex-col items-center gap-2">
                <Zap className="h-6 w-6" />
                <div>
                  <div className="font-semibold text-lg">Build from Scratch</div>
                  <div className="text-xs text-muted-foreground">
                    Start with a blank canvas and add your own nodes
                  </div>
                </div>
              </div>
            </Button>

            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2 text-sm">Popular Templates:</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>• Quote to Project Pipeline</div>
                <div>• Service Order to Invoice</div>
                <div>• Project Completion Flow</div>
                <div>• New Project Setup</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <WorkflowTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelectTemplate={(template) => {
          onSelectTemplate(template);
          setTemplatesOpen(false);
        }}
      />
    </>
  );
}
