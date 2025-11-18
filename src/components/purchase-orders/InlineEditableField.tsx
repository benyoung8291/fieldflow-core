import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface InlineEditableFieldProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  label: string;
  type?: "input" | "textarea" | "date";
  readOnly?: boolean;
}

export function InlineEditableField({
  value,
  onSave,
  label,
  type = "input",
  readOnly = false,
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  if (readOnly || !isEditing) {
    return (
      <div
        className={`p-2 rounded-md ${!readOnly ? "hover:bg-muted cursor-pointer" : ""}`}
        onClick={() => !readOnly && setIsEditing(true)}
      >
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="text-sm">{value || "—"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      {type === "textarea" ? (
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="min-h-[80px]"
        />
      ) : (
        <Input
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
        />
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
