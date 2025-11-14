import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckSquare, X } from "lucide-react";

interface InlineCheckboxEditorProps {
  onSave: (data: { items: string[] }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export function InlineCheckboxEditor({ onSave, onCancel, isSaving }: InlineCheckboxEditorProps) {
  const [content, setContent] = useState("");

  const handleSave = async () => {
    const items = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (items.length === 0) return;
    
    await onSave({ items });
    setContent("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const itemCount = content.split('\n').filter(line => line.trim().length > 0).length;

  return (
    <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CheckSquare className="h-4 w-4" />
          <span>Add Checklist Items</span>
        </div>
        {itemCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      <div>
        <Label className="text-xs">Checklist Items (one per line)</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Enter checklist items, one per line..."
          className="min-h-[100px] resize-y"
          autoFocus
        />
        <p className="text-xs text-muted-foreground mt-1">
          Press Ctrl+Enter to save, or Enter for new line
        </p>
      </div>
      
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
          disabled={itemCount === 0 || isSaving}
        >
          {isSaving ? "Creating..." : `Create ${itemCount} Item${itemCount !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
