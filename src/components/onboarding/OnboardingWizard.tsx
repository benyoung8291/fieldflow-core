import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight, ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: userTeams } = useQuery({
    queryKey: ["user-teams", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_teams")
        .select("team_id, teams(name, enabled_modules)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: onboardingSteps } = useQuery({
    queryKey: ["onboarding-steps", userTeams],
    queryFn: async () => {
      if (!userTeams || userTeams.length === 0) return [];
      
      const teamIds = userTeams.map((ut) => ut.team_id);
      const { data, error } = await supabase
        .from("team_onboarding_steps")
        .select("*")
        .in("team_id", teamIds)
        .eq("is_active", true)
        .order("step_order");
      
      if (error) throw error;
      return data;
    },
    enabled: !!userTeams && userTeams.length > 0,
  });

  const { data: completedSteps } = useQuery({
    queryKey: ["onboarding-progress", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_onboarding_progress")
        .select("step_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((p) => p.step_id);
    },
    enabled: !!user,
  });

  const markStepCompleteMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { error } = await supabase
        .from("user_onboarding_progress")
        .insert({
          user_id: user.id,
          step_id: stepId,
          tenant_id: profile!.tenant_id,
        });
      
      if (error && error.code !== "23505") throw error; // Ignore duplicate errors
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
    },
  });

  const skipStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const { error } = await supabase
        .from("user_onboarding_progress")
        .insert({
          user_id: user.id,
          step_id: stepId,
          tenant_id: profile!.tenant_id,
          skipped: true,
        });
      
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-progress"] });
    },
  });

  useEffect(() => {
    if (onboardingSteps && onboardingSteps.length > 0 && completedSteps) {
      const hasIncompleteSteps = onboardingSteps.some(
        (step) => !completedSteps.includes(step.id)
      );
      if (hasIncompleteSteps) {
        setOpen(true);
      }
    }
  }, [onboardingSteps, completedSteps]);

  if (!onboardingSteps || onboardingSteps.length === 0 || !completedSteps) {
    return null;
  }

  const incompleteSteps = onboardingSteps.filter(
    (step) => !completedSteps.includes(step.id)
  );

  if (incompleteSteps.length === 0) {
    return null;
  }

  const currentStep = incompleteSteps[currentStepIndex];
  const progress = ((completedSteps.length) / onboardingSteps.length) * 100;

  const handleNext = async () => {
    if (currentStep) {
      await markStepCompleteMutation.mutateAsync(currentStep.id);
      
      if (currentStep.route) {
        navigate(currentStep.route);
      }
    }

    if (currentStepIndex < incompleteSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      toast.success("Onboarding completed!");
      setOpen(false);
    }
  };

  const handleSkip = async () => {
    if (currentStep) {
      await skipStepMutation.mutateAsync(currentStep.id);
    }

    if (currentStepIndex < incompleteSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setOpen(false);
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{currentStep.title}</DialogTitle>
          <DialogDescription>
            Step {completedSteps.length + 1} of {onboardingSteps.length}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Progress value={progress} className="w-full" />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <span className="text-sm font-medium text-primary">
                  {currentStep.module}
                </span>
              </div>
            </div>

            {currentStep.description && (
              <p className="text-muted-foreground">{currentStep.description}</p>
            )}

            {currentStep.content && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(currentStep.content, {
                      ALLOWED_TAGS: [
                        'p', 'br', 'strong', 'b', 'em', 'i', 'u',
                        'ul', 'ol', 'li', 'a', 
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                        'div', 'span', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
                      ],
                      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style']
                    })
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onboardingSteps.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-center gap-2"
              >
                {completedSteps.includes(step.id) ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
              <Button onClick={handleNext}>
                {currentStepIndex < incompleteSteps.length - 1 ? "Next" : "Complete"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
