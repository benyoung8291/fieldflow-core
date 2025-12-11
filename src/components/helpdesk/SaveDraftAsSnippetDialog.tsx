import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface SaveDraftAsSnippetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
}

const SNIPPET_CATEGORIES = [
  "General",
  "Greetings",
  "Closings",
  "Updates",
  "FAQ",
  "Other",
];

export function SaveDraftAsSnippetDialog({
  open,
  onOpenChange,
  content,
}: SaveDraftAsSnippetDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");

  const saveSnippetMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { error } = await supabase.from("email_snippets").insert({
        name: name.trim(),
        content,
        category,
        tenant_id: profile.tenant_id,
        created_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Snippet saved",
        description: "Your email content has been saved as a reusable snippet",
      });
      queryClient.invalidateQueries({ queryKey: ["email-snippets"] });
      queryClient.invalidateQueries({ queryKey: ["email-snippets-for-inserter"] });
      setName("");
      setCategory("General");
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error saving snippet",
        description: error instanceof Error ? error.message : "Failed to save snippet",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your snippet",
        variant: "destructive",
      });
      return;
    }
    saveSnippetMutation.mutate();
  };

  // Strip HTML for preview
  const getPlainTextPreview = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Snippet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="snippet-name">Snippet Name</Label>
            <Input
              id="snippet-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name for this snippet"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snippet-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {SNIPPET_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Content Preview</Label>
            <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground max-h-32 overflow-y-auto">
              {getPlainTextPreview(content).slice(0, 300)}
              {getPlainTextPreview(content).length > 300 && "..."}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveSnippetMutation.isPending}>
            {saveSnippetMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Save Snippet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
