import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, X } from "lucide-react";
import { MentionTextarea } from "./MentionTextarea";

interface InlineNoteEditorProps {
  onSave: (content: string, mentions: string[]) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export function InlineNoteEditor({ onSave, onCancel, isSaving }: InlineNoteEditorProps) {
  const [content, setContent] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);

  const handleSave = async () => {
    if (!content.trim()) return;
    await onSave(content, mentions);
    setContent("");
    setMentions([]);
  };

  return (
    <div className="border rounded-lg p-3 bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-500">
        <MessageSquare className="h-4 w-4" />
        <span>Add Internal Note</span>
        <span className="text-xs text-muted-foreground ml-2">(Use @ to mention users)</span>
      </div>
      
      <MentionTextarea
        value={content}
        onChange={(value, userMentions) => {
          setContent(value);
          setMentions(userMentions);
        }}
        placeholder="Type your internal note here... Use @ to mention users"
        rows={3}
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
