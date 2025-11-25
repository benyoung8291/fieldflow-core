import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Pin } from "lucide-react";

interface SaveSnippetAsNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: "service_order" | "appointment" | "project";
  documentId: string;
  initialContent: string;
}

export function SaveSnippetAsNoteDialog({
  open,
  onOpenChange,
  documentType,
  documentId,
  initialContent,
}: SaveSnippetAsNoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initialContent);
  const [isSticky, setIsSticky] = useState(false);

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase
        .from("document_notes")
        .insert({
          tenant_id: profile.tenant_id,
          document_type: documentType,
          document_id: documentId,
          content,
          is_sticky: isSticky,
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["document-notes", documentType, documentId] 
      });
      toast({ title: "Note saved successfully" });
      onOpenChange(false);
      setContent("");
      setIsSticky(false);
    },
    onError: () => {
      toast({ 
        title: "Failed to save note", 
        variant: "destructive" 
      });
    },
  });

  const handleSave = () => {
    if (!content.trim()) {
      toast({ 
        title: "Note cannot be empty", 
        variant: "destructive" 
      });
      return;
    }
    createNoteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save as Note</DialogTitle>
          <DialogDescription>
            Create a quick note that will be attached to this document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="note-content">Note Content</Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add your note..."
              className="min-h-[120px] resize-none mt-2"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="sticky"
              checked={isSticky}
              onCheckedChange={(checked) => setIsSticky(checked as boolean)}
            />
            <Label
              htmlFor="sticky"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
            >
              <Pin className="h-3 w-3" />
              Make this a sticky note (only one sticky note per document)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={createNoteMutation.isPending}
          >
            {createNoteMutation.isPending ? "Saving..." : "Save Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
