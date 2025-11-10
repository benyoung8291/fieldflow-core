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
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

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
  
  // Check if value contains a link pattern
  if (value.includes("Link: /")) {
    const linkMatch = value.match(/Link: (\/[^\s]+)/);
    if (linkMatch) {
      const parts = value.split("Link:");
      return parts[0].trim();
    }
  }
  
  // Truncate long values
  if (value.length > 100) {
    return value.substring(0, 100) + "...";
  }
  
  return value;
}

function extractLink(note: string | undefined): string | null {
  if (!note) return null;
  const linkMatch = note.match(/Link: (\/[^\s]+)/);
  return linkMatch ? linkMatch[1] : null;
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
    <div className="space-y-3">
      {logs.map((log, index) => {
        const Icon = actionIcons[log.action];
        const isEditing = editingNote === log.id;

        return (
          <div key={log.id} className="relative">
            {/* Timeline line */}
            {index < logs.length - 1 && (
              <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
            )}

            <div className="flex gap-3">
              {/* Icon */}
              <div className={cn(
                "h-8 w-8 rounded-full border-2 border-background bg-card flex items-center justify-center shadow-sm flex-shrink-0",
                actionColors[log.action]
              )}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Content */}
              <div className="flex-1 space-y-1">
                <Card className="p-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className={cn("capitalize text-[10px] py-0 px-1", actionColors[log.action])}>
                          {actionLabels[log.action]}
                        </Badge>
                        {log.field_name && (
                          <span className="text-xs font-medium truncate">
                            {formatFieldName(log.field_name)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{log.user_name}</span>
                        {" • "}
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    {log.action === "update" && log.field_name && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevert(log.id, log)}
                        disabled={revertChange.isPending}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Undo2 className="h-3 w-3" />
                        Revert
                      </Button>
                    )}
                  </div>

                  {/* Change details */}
                  {log.action === "update" && log.field_name && (
                    <div className="space-y-1">
                      <Separator />
                      <div className="grid grid-cols-2 gap-2 text-xs py-1">
                        <div>
                          <div className="text-muted-foreground text-[10px] mb-0.5">From:</div>
                          <div className="font-mono text-[10px] bg-muted p-1.5 rounded truncate">
                            {formatValue(log.old_value)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-[10px] mb-0.5">To:</div>
                          <div className="font-mono text-[10px] bg-primary/5 p-1.5 rounded border border-primary/20 truncate">
                            {formatValue(log.new_value)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {log.note && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex items-start gap-1.5 text-xs">
                        <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-muted-foreground text-[10px] mb-0.5">Note:</div>
                          <div className="text-foreground">
                            {formatValue(log.note)}
                            {extractLink(log.note) && (
                              <Link 
                                to={extractLink(log.note)!} 
                                className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
                              >
                                View Document
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add note section */}
                  {!log.note && (
                    <div className="mt-2 pt-2 border-t">
                      {isEditing ? (
                        <div className="space-y-1.5">
                          <Textarea
                            placeholder="Add a note..."
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            rows={2}
                            autoFocus
                            className="text-xs"
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleAddNote(log.id)}
                              disabled={!noteText.trim() || addNote.isPending}
                              className="h-7 px-2 text-xs gap-1"
                            >
                              <Save className="h-3 w-3" />
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingNote(null);
                                setNoteText("");
                              }}
                              className="h-7 px-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingNote(log.id)}
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                        >
                          <MessageSquare className="h-3 w-3" />
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
