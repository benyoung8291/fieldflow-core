import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Snippet {
  id: string;
  name: string;
  content: string;
  category: string | null;
  is_shared: boolean;
  created_by: string;
}

interface SnippetManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = ["General", "Greetings", "Closings", "Updates", "FAQ", "Other"];

export function SnippetManager({ open, onOpenChange }: SnippetManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    category: "General",
    is_shared: true,
  });

  const { data: snippets = [], isLoading } = useQuery({
    queryKey: ["email-snippets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_snippets")
        .select("*")
        .order("category")
        .order("name");

      if (error) throw error;
      return data as Snippet[];
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user?.id || "")
        .single();

      const { error } = await supabase.from("email_snippets").insert({
        name: data.name,
        content: data.content,
        category: data.category,
        is_shared: data.is_shared,
        tenant_id: profile?.tenant_id,
        created_by: user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-snippets"] });
      toast({ title: "Snippet created successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create snippet", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("email_snippets")
        .update({
          name: data.name,
          content: data.content,
          category: data.category,
          is_shared: data.is_shared,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-snippets"] });
      toast({ title: "Snippet updated successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update snippet", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_snippets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-snippets"] });
      toast({ title: "Snippet deleted successfully" });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete snippet", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", content: "", category: "General", is_shared: true });
    setEditingSnippet(null);
    setIsCreating(false);
  };

  const handleEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setFormData({
      name: snippet.name,
      content: snippet.content,
      category: snippet.category || "General",
      is_shared: snippet.is_shared,
    });
    setIsCreating(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast({ title: "Name and content are required", variant: "destructive" });
      return;
    }

    if (editingSnippet) {
      updateMutation.mutate({ id: editingSnippet.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const groupedSnippets = snippets.reduce((acc, snippet) => {
    const category = snippet.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(snippet);
    return acc;
  }, {} as Record<string, Snippet[]>);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Email Snippets</DialogTitle>
          </DialogHeader>

          {isCreating ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Snippet Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Thank you message"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter the snippet content..."
                  className="min-h-[150px]"
                />
              </div>

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button 
                  onClick={handleSave} 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingSnippet ? "Update" : "Create"} Snippet
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {isLoading ? (
                  <div className="text-center text-muted-foreground py-8">Loading snippets...</div>
                ) : Object.keys(groupedSnippets).length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No snippets yet</p>
                    <p className="text-sm text-muted-foreground">Create your first snippet to save time</p>
                  </div>
                ) : (
                  Object.entries(groupedSnippets).map(([category, categorySnippets]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">{category}</h4>
                      <div className="space-y-1">
                        {categorySnippets.map((snippet) => (
                          <div
                            key={snippet.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{snippet.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{snippet.content}</p>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(snippet)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirm(snippet.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Snippet
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Snippet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this snippet? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}