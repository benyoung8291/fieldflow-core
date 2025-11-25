import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface TutorialStep {
  title: string;
  description: string;
  image?: string;
  tips?: string[];
}

interface ModuleTutorialProps {
  moduleName: string;
  defaultSteps: TutorialStep[];
  title?: string;
  description?: string;
}

export function ModuleTutorial({ moduleName, defaultSteps, title, description }: ModuleTutorialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Check if user has completed this tutorial
  const { data: tutorialProgress } = useQuery({
    queryKey: ["tutorial-progress", moduleName, profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from("user_module_tutorials")
        .select("*")
        .eq("user_id", profile.id)
        .eq("module_name", moduleName)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Get custom tutorial content if available
  const { data: customContent } = useQuery({
    queryKey: ["tutorial-content", moduleName, profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;
      
      const { data, error } = await supabase
        .from("module_tutorial_content")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("module_name", moduleName)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (skipped: boolean = false) => {
      if (!profile?.id || !profile?.tenant_id) return;
      
      const { error } = await supabase
        .from("user_module_tutorials")
        .insert({
          user_id: profile.id,
          tenant_id: profile.tenant_id,
          module_name: moduleName,
          skipped,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-progress"] });
      setIsOpen(false);
      toast.success("Tutorial completed!");
    },
  });

  // Show tutorial on first access
  useEffect(() => {
    if (tutorialProgress === undefined) return;
    if (tutorialProgress === null && profile?.id) {
      setIsOpen(true);
    }
  }, [tutorialProgress, profile]);

  const steps = (Array.isArray(customContent?.steps) ? customContent.steps : defaultSteps) as TutorialStep[];
  const tutorialTitle = customContent?.title || title || `${moduleName} Tutorial`;
  const tutorialDescription = customContent?.description || description || "Learn how to use this module effectively";

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      markCompleteMutation.mutate(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    markCompleteMutation.mutate(true);
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{tutorialTitle}</DialogTitle>
              <DialogDescription>{tutorialDescription}</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          <Progress value={progress} className="w-full" />
          
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2">
                Step {currentStep + 1} of {steps.length}: {currentStepData?.title}
              </h3>
              <p className="text-muted-foreground">{currentStepData?.description}</p>
            </div>

            {currentStepData?.image && (
              <div className="rounded-lg overflow-hidden border">
                <img 
                  src={currentStepData.image} 
                  alt={currentStepData.title}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            {currentStepData?.tips && currentStepData.tips.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Quick Tips
                </h4>
                <ul className="space-y-1 text-sm">
                  {currentStepData.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            <div className="text-sm text-muted-foreground">
              {currentStep + 1} / {steps.length}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip}>
                Skip Tutorial
              </Button>
              <Button onClick={handleNext}>
                {currentStep === steps.length - 1 ? (
                  <>
                    Complete
                    <CheckCircle2 className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
