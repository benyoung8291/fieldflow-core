import { useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const IssueReportDialog = () => {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Please describe the issue");
      return;
    }

    setIsSubmitting(true);
    try {
      // Capture current context
      const currentPage = window.location.href;
      const currentPath = window.location.pathname;
      
      // Get console logs from session storage if available
      const recentLogs = [];
      try {
        // Capture last few console entries (simple approach)
        const logCache = (window as any).__logCache || [];
        recentLogs.push(...logCache.slice(-10));
      } catch (e) {
        // Ignore if logs not available
      }

      const { error } = await supabase.functions.invoke('report-issue', {
        body: {
          description,
          currentPage,
          currentPath,
          logs: recentLogs.length > 0 ? recentLogs.join('\n') : 'No logs captured',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        }
      });

      if (error) throw error;

      toast.success("Issue reported successfully");
      setDescription("");
      setOpen(false);
    } catch (error: any) {
      console.error('Error reporting issue:', error);
      toast.error("Failed to report issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Bug className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Describe the problem you're experiencing. We'll capture the current page and logs automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Textarea
            placeholder="Describe what went wrong or what you expected to happen..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="resize-none"
          />
          <div className="text-xs text-muted-foreground">
            Current page and technical details will be included automatically.
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Report Issue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
