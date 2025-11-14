import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineNoteEditorProps {
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export function InlineNoteEditor({ onSave, onCancel, isSaving }: InlineNoteEditorProps) {
  const [content, setContent] = useState("");

  const handleSave = async () => {
    if (!content.trim()) return;
    await onSave(content);
    setContent("");
  };

  return (
    <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        <span>Add Internal Note</span>
      </div>
      
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your internal note here..."
        className="min-h-[80px] resize-none"
        autoFocus
      />
      
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!content.trim() || isSaving}
        >
          {isSaving ? "Saving..." : "Save Note"}
        </Button>
      </div>
    </div>
  );
}
