import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pin, Trash2, Edit2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DocumentNotesProps {
  documentType: "service_order" | "appointment" | "project";
  documentId: string;
}

export function DocumentNotes({ documentType, documentId }: DocumentNotesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["document-notes", documentType, documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_notes")
        .select(`
          *,
          profiles:created_by(first_name, last_name)
        `)
        .eq("document_type", documentType)
        .eq("document_id", documentId)
        .order("is_sticky", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async ({ content, isSticky }: { content: string; isSticky: boolean }) => {
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
      queryClient.invalidateQueries({ queryKey: ["document-notes", documentType, documentId] });
      toast({ title: "Note created successfully" });
      setIsCreating(false);
      setNewNoteContent("");
    },
    onError: () => {
      toast({ title: "Failed to create note", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, content, isSticky }: { id: string; content?: string; isSticky?: boolean }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (content !== undefined) updates.content = content;
      if (isSticky !== undefined) updates.is_sticky = isSticky;

      const { error } = await supabase
        .from("document_notes")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-notes", documentType, documentId] });
      toast({ title: "Note updated successfully" });
      setEditingNoteId(null);
    },
    onError: () => {
      toast({ title: "Failed to update note", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("document_notes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-notes", documentType, documentId] });
      toast({ title: "Note deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  const handleCreateNote = (isSticky: boolean = false) => {
    if (!newNoteContent.trim()) return;
    createNoteMutation.mutate({ content: newNoteContent, isSticky });
  };

  const handleToggleSticky = (note: any) => {
    updateNoteMutation.mutate({
      id: note.id,
      isSticky: !note.is_sticky,
    });
  };

  const handleStartEdit = (note: any) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (!editingNoteId || !editContent.trim()) return;
    updateNoteMutation.mutate({
      id: editingNoteId,
      content: editContent,
    });
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent("");
  };

  const stickyNote = notes.find((n) => n.is_sticky);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky note alert - displayed prominently */}
      {stickyNote && (
        <Card 
          className={cn(
            "border-2 border-warning/50 bg-warning/5 shadow-lg animate-in fade-in slide-in-from-top-2",
            "transition-all duration-300 hover:shadow-xl hover:border-warning"
          )}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Pin className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {editingNoteId === stickyNote.id ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[80px] resize-none bg-background"
                      placeholder="Note content..."
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Check className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">
                      {stickyNote.content}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <span>
                        {stickyNote.profiles?.first_name} {stickyNote.profiles?.last_name}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(stickyNote.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </>
                )}
              </div>
              {editingNoteId !== stickyNote.id && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleStartEdit(stickyNote)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-warning hover:text-warning"
                    onClick={() => handleToggleSticky(stickyNote)}
                  >
                    <Pin className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteNoteMutation.mutate(stickyNote.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create new note */}
      {isCreating ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-6 space-y-3">
            <Textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Add a quick note..."
              className="min-h-[100px] resize-none"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => handleCreateNote(false)}>
                Add Note
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCreateNote(true)}
                className="border-warning text-warning hover:bg-warning/10"
              >
                <Pin className="h-3 w-3 mr-1" />
                Make Sticky
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setIsCreating(false);
                setNewNoteContent("");
              }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreating(true)}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      )}

      {/* Regular notes grid */}
      {notes.filter((n) => !n.is_sticky).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes
            .filter((n) => !n.is_sticky)
            .map((note) => (
              <Card
                key={note.id}
                className="group hover:shadow-md transition-all duration-200 hover:border-primary/30"
              >
                <CardContent className="p-4">
                  {editingNoteId === note.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px] resize-none text-sm"
                        placeholder="Note content..."
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Check className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-3">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          <div>
                            {note.profiles?.first_name} {note.profiles?.last_name}
                          </div>
                          <div>{format(new Date(note.created_at), "MMM d, yyyy")}</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleStartEdit(note)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleToggleSticky(note)}
                          >
                            <Pin className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {notes.length === 0 && !isCreating && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No notes yet. Add one to get started!
        </div>
      )}
    </div>
  );
}
