import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare, X } from "lucide-react";

interface InlineCheckboxEditorProps {
  onSave: (data: { title: string }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export function InlineCheckboxEditor({ onSave, onCancel, isSaving }: InlineCheckboxEditorProps) {
  const [title, setTitle] = useState("");

  const handleSave = async () => {
    if (!title.trim()) return;
    await onSave({ title });
    setTitle("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CheckSquare className="h-4 w-4" />
        <span>Add Checkbox</span>
      </div>
      
      <div>
        <Label className="text-xs">Checkbox Item</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter checkbox item..."
          className="h-8"
          autoFocus
        />
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
          disabled={!title.trim() || isSaving}
        >
          {isSaving ? "Creating..." : "Create Checkbox"}
        </Button>
      </div>
    </div>
  );
}
