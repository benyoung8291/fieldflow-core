import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserCheck, AlertCircle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WorkerSuggestion {
  worker_id: string;
  worker_name: string;
  score: number;
  skills_match: boolean;
  reasoning: string;
  suggested_date?: string;
  availability_notes?: string;
}

interface WorkerSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceOrderId: string;
  serviceOrderTitle: string;
  onSelectWorker: (workerId: string, suggestedDate?: string) => void;
}

export default function WorkerSuggestionsDialog({
  open,
  onOpenChange,
  serviceOrderId,
  serviceOrderTitle,
  onSelectWorker,
}: WorkerSuggestionsDialogProps) {
  const [suggestions, setSuggestions] = useState<WorkerSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetSuggestions = async () => {
    setIsLoading(true);
    setSuggestions([]);

    try {
      const { data, error } = await supabase.functions.invoke('suggest-workers', {
        body: { serviceOrderId }
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("Too many requests. Please wait a moment and try again.");
        } else if (data.error.includes("Payment required")) {
          toast.error("AI credits exhausted. Please add credits to continue.");
        } else {
          toast.error(data.error);
        }
        return;
      }

      setSuggestions(data.suggestions || []);
      
      if (!data.suggestions || data.suggestions.length === 0) {
        toast.info("No suitable workers found for this service order");
      } else {
        toast.success(`Found ${data.suggestions.length} worker recommendations`);
      }
    } catch (error: any) {
      console.error("Error getting worker suggestions:", error);
      toast.error("Failed to get worker suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-success text-success-foreground";
    if (score >= 60) return "bg-warning text-warning-foreground";
    return "bg-muted text-muted-foreground";
  };

  const handleSelectWorker = (suggestion: WorkerSuggestion) => {
    onSelectWorker(suggestion.worker_id, suggestion.suggested_date);
    onOpenChange(false);
    toast.success(`Selected ${suggestion.worker_name} for scheduling`);
  };

  // Auto-fetch suggestions when dialog opens
  useEffect(() => {
    if (open && suggestions.length === 0 && !isLoading) {
      handleGetSuggestions();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Worker Recommendations</DialogTitle>
          <DialogDescription>
            Smart worker suggestions for: {serviceOrderTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Analyzing workers and schedules...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Click below to get AI-powered worker recommendations</p>
              <Button onClick={handleGetSuggestions} className="mt-4">
                Get Recommendations
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Recommended Workers</h3>
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        {suggestion.worker_name}
                        {!suggestion.skills_match && (
                          <Badge variant="destructive" className="text-xs">
                            Skills Gap
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge className={cn("text-xs", getScoreColor(suggestion.score))}>
                        {suggestion.score}% match
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    {suggestion.suggested_date && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Best date: {new Date(suggestion.suggested_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {suggestion.availability_notes && (
                      <p className="text-sm text-muted-foreground italic">
                        {suggestion.availability_notes}
                      </p>
                    )}

                    <p className="text-sm">{suggestion.reasoning}</p>

                    <Button 
                      onClick={() => handleSelectWorker(suggestion)}
                      variant={suggestion.skills_match ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                    >
                      {suggestion.skills_match ? "Schedule with this worker" : "Schedule anyway"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
