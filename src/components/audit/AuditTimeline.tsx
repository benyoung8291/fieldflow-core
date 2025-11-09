import { useState } from "react";
import { useAuditLog } from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { 
  AlertCircle, 
  CheckCircle, 
  Edit, 
  Plus, 
  Trash, 
  Undo2, 
  MessageSquare,
  Save,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface AuditTimelineProps {
  tableName: string;
  recordId: string;
}

const actionIcons = {
  create: Plus,
  update: Edit,
  delete: Trash,
  revert: Undo2,
};

const actionColors = {
  create: "text-success",
  update: "text-info",
  delete: "text-destructive",
  revert: "text-warning",
};

const actionLabels = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  revert: "Reverted",
};

function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: string | undefined): string {
  if (!value) return "—";
  if (value === "null" || value === "undefined") return "—";
  
  // Truncate long values
  if (value.length > 100) {
    return value.substring(0, 100) + "...";
  }
  
  return value;
}

export default function AuditTimeline({ tableName, recordId }: AuditTimelineProps) {
  const { logs, isLoading, addNote, revertChange } = useAuditLog(tableName, recordId);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-muted"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No change history available</p>
      </div>
    );
  }

  const handleAddNote = async (logId: string) => {
    if (!noteText.trim()) return;
    await addNote.mutateAsync({ logId, note: noteText });
    setEditingNote(null);
    setNoteText("");
  };

  const handleRevert = async (logId: string, log: any) => {
    if (window.confirm("Are you sure you want to revert this change?")) {
      await revertChange.mutateAsync({ logId, log });
    }
  };

  return (
    <div className="space-y-6">
      {logs.map((log, index) => {
        const Icon = actionIcons[log.action];
        const isEditing = editingNote === log.id;

        return (
          <div key={log.id} className="relative">
            {/* Timeline line */}
            {index < logs.length - 1 && (
              <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-border" />
            )}

            <div className="flex gap-4">
              {/* Icon */}
              <div className={cn(
                "h-10 w-10 rounded-full border-2 border-background bg-card flex items-center justify-center shadow-sm flex-shrink-0",
                actionColors[log.action]
              )}>
                <Icon className="h-5 w-5" />
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <Card className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("capitalize", actionColors[log.action])}>
                          {actionLabels[log.action]}
                        </Badge>
                        {log.field_name && (
                          <span className="text-sm font-medium">
                            {formatFieldName(log.field_name)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        by <span className="font-medium text-foreground">{log.user_name}</span>
                        {" • "}
                        {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    {log.action === "update" && log.field_name && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevert(log.id, log)}
                        disabled={revertChange.isPending}
                        className="gap-2"
                      >
                        <Undo2 className="h-4 w-4" />
                        Revert
                      </Button>
                    )}
                  </div>

                  {/* Change details */}
                  {log.action === "update" && log.field_name && (
                    <div className="space-y-2">
                      <Separator />
                      <div className="grid grid-cols-2 gap-4 text-sm py-2">
                        <div>
                          <div className="text-muted-foreground mb-1">From:</div>
                          <div className="font-mono text-xs bg-muted p-2 rounded">
                            {formatValue(log.old_value)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">To:</div>
                          <div className="font-mono text-xs bg-primary/5 p-2 rounded border border-primary/20">
                            {formatValue(log.new_value)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {log.note && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-start gap-2 text-sm">
                        <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <div className="text-muted-foreground mb-1">Note:</div>
                          <div className="text-foreground">{log.note}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add note section */}
                  {!log.note && (
                    <div className="mt-3 pt-3 border-t">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Add a note about this change..."
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAddNote(log.id)}
                              disabled={!noteText.trim() || addNote.isPending}
                              className="gap-2"
                            >
                              <Save className="h-4 w-4" />
                              Save Note
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingNote(null);
                                setNoteText("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingNote(log.id)}
                          className="gap-2 text-muted-foreground"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Add Note
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
