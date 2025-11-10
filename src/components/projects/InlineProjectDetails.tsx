import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Edit2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineProjectDetailsProps {
  project: any;
}

export default function InlineProjectDetails({ project }: InlineProjectDetailsProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>("");
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      const { error } = await supabase
        .from("projects")
        .update({ [field]: value })
        .eq("id", project.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      toast.success("Project updated");
      setEditingField(null);
    },
    onError: () => {
      toast.error("Failed to update project");
    },
  });

  const handleEdit = (field: string, currentValue: any) => {
    setEditingField(field);
    setEditValue(currentValue || "");
  };

  const handleSave = () => {
    if (editingField) {
      updateMutation.mutate({ field: editingField, value: editValue });
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue("");
  };

  const EditableField = ({ 
    field, 
    label, 
    value, 
    type = "text",
    format: formatFn,
    options,
  }: { 
    field: string; 
    label: string; 
    value: any; 
    type?: "text" | "textarea" | "date" | "number" | "select";
    format?: (value: any) => string;
    options?: { value: string; label: string }[];
  }) => {
    const isEditing = editingField === field;
    const displayValue = formatFn ? formatFn(value) : value || "—";

    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-sm font-medium">{label}</Label>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(field, value)}
              className="h-6 w-6 p-0"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {isEditing ? (
          <div className="space-y-2">
            {type === "textarea" ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={3}
                autoFocus
              />
            ) : type === "select" && options ? (
              <Select value={editValue} onValueChange={setEditValue}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={type}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="h-7"
              >
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                className="h-7"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className={cn(
            "text-sm mt-1 whitespace-pre-wrap",
            value ? "text-muted-foreground" : "text-muted-foreground/50 italic"
          )}>
            {displayValue}
          </p>
        )}
      </div>
    );
  };

  const statusOptions = [
    { value: "planning", label: "Planning" },
    { value: "active", label: "Active" },
    { value: "on_hold", label: "On Hold" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <EditableField
          field="name"
          label="Project Name"
          value={project.name}
        />

        <EditableField
          field="description"
          label="Description"
          value={project.description}
          type="textarea"
        />

        <EditableField
          field="status"
          label="Status"
          value={project.status}
          type="select"
          options={statusOptions}
          format={(val) => val ? val.replace("_", " ").charAt(0).toUpperCase() + val.slice(1).replace("_", " ") : ""}
        />

        <div className="grid grid-cols-2 gap-4">
          <EditableField
            field="start_date"
            label="Start Date"
            value={project.start_date}
            type="date"
            format={(val) => val ? format(new Date(val), "MMM d, yyyy") : ""}
          />

          <EditableField
            field="end_date"
            label="End Date"
            value={project.end_date}
            type="date"
            format={(val) => val ? format(new Date(val), "MMM d, yyyy") : ""}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <EditableField
            field="budget"
            label="Budget"
            value={project.budget}
            type="number"
            format={(val) => val ? `$${val.toLocaleString()}` : ""}
          />

          <EditableField
            field="progress"
            label="Progress (%)"
            value={project.progress}
            type="number"
          />
        </div>

        <EditableField
          field="notes"
          label="Notes"
          value={project.notes}
          type="textarea"
        />

        <div>
          <Label className="text-sm font-medium">Created By</Label>
          <p className="text-sm text-muted-foreground mt-1">
            {project.creator?.first_name} {project.creator?.last_name} on{" "}
            {format(new Date(project.created_at), "MMM d, yyyy")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
