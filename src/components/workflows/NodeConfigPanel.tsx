import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Trash2 } from "lucide-react";
import { Node } from "reactflow";

interface NodeConfigPanelProps {
  selectedNode: Node | null;
  onClose: () => void;
  onSave: (nodeId: string, config: any) => void;
  onDelete: (nodeId: string) => void;
}

export default function NodeConfigPanel({ selectedNode, onClose, onSave, onDelete }: NodeConfigPanelProps) {
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    if (selectedNode) {
      setConfig(selectedNode.data.config || {});
    }
  }, [selectedNode]);

  if (!selectedNode) return null;

  const handleSave = () => {
    onSave(selectedNode.id, config);
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Delete this ${selectedNode.type === 'trigger' ? 'trigger' : selectedNode.type === 'condition' ? 'condition' : 'action'} node?`)) {
      onDelete(selectedNode.id);
      onClose();
    }
  };

  const renderConfigFields = () => {
    const nodeType = selectedNode.type;
    const actionType = selectedNode.data.actionType;

    if (nodeType === "trigger") {
      return (
        <div className="space-y-4">
          <div>
            <Label>Trigger Type</Label>
            <Input value={selectedNode.data.triggerType || ""} disabled className="bg-muted" />
          </div>
          <p className="text-sm text-muted-foreground">
            This workflow will execute when this trigger event occurs.
          </p>
        </div>
      );
    }

    if (nodeType === "condition") {
      return (
        <div className="space-y-4">
          <div>
            <Label>Condition Type</Label>
            <Select
              value={config.conditionType || "field_comparison"}
              onValueChange={(value) => setConfig({ ...config, conditionType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="field_comparison">Field Comparison</SelectItem>
                <SelectItem value="is_assigned_to_current_user">Is Assigned to Current User</SelectItem>
                <SelectItem value="is_created_by_current_user">Is Created by Current User</SelectItem>
                <SelectItem value="has_customer">Has Customer</SelectItem>
                <SelectItem value="has_project">Has Project Link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.conditionType === "field_comparison" && (
            <>
              <div>
                <Label>Condition Field</Label>
                <Select
                  value={config.field || ""}
                  onValueChange={(value) => setConfig({ ...config, field: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select field to check" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="total_amount">Total Amount</SelectItem>
                    <SelectItem value="customer_id">Customer</SelectItem>
                    <SelectItem value="assigned_to">Assigned To</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Operator</Label>
                <Select
                  value={config.operator || "equals"}
                  onValueChange={(value) => setConfig({ ...config, operator: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="not_equals">Not Equals</SelectItem>
                    <SelectItem value="greater_than">Greater Than</SelectItem>
                    <SelectItem value="less_than">Less Than</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  value={config.value || ""}
                  onChange={(e) => setConfig({ ...config, value: e.target.value })}
                  placeholder="Enter comparison value"
                />
              </div>
            </>
          )}

          {config.conditionType && config.conditionType !== "field_comparison" && (
            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
              This condition will check the relationship between the current user and the triggered document.
            </div>
          )}
        </div>
      );
    }

    if (nodeType === "action") {
      switch (actionType) {
        case "delay":
          return (
            <div className="space-y-4">
              <div>
                <Label>Delay Duration</Label>
                <Input
                  type="number"
                  value={config.duration || ""}
                  onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
                  placeholder="Enter number"
                />
              </div>
              <div>
                <Label>Time Unit</Label>
                <Select
                  value={config.unit || "minutes"}
                  onValueChange={(value) => setConfig({ ...config, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          );

        case "send_email":
          return (
            <div className="space-y-4">
              <div>
                <Label>To</Label>
                <Input
                  value={config.to || ""}
                  onChange={(e) => setConfig({ ...config, to: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <Label>Subject</Label>
                <Input
                  value={config.subject || ""}
                  onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                  placeholder="Email subject"
                />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  value={config.message || ""}
                  onChange={(e) => setConfig({ ...config, message: e.target.value })}
                  placeholder="Email body content"
                  rows={6}
                />
              </div>
            </div>
          );

        case "create_project":
        case "create_service_order":
        case "create_invoice":
          return (
            <div className="space-y-4">
              <div>
                <Label>Document Name</Label>
                <Input
                  value={config.name || ""}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder="Enter document name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={config.description || ""}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  placeholder="Enter description"
                  rows={4}
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.copy_line_items || false}
                    onChange={(e) => setConfig({ ...config, copy_line_items: e.target.checked })}
                    className="rounded"
                  />
                  Copy line items from source document
                </Label>
              </div>
            </div>
          );

        case "create_task":
          return (
            <div className="space-y-4">
              <div>
                <Label>Task Title</Label>
                <Input
                  value={config.title || ""}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={config.description || ""}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  placeholder="Enter task description"
                  rows={4}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={config.priority || "medium"}
                  onValueChange={(value) => setConfig({ ...config, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          );

        case "create_checklist":
          return (
            <div className="space-y-4">
              <div>
                <Label>Checklist Title</Label>
                <Input
                  value={config.title || ""}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  placeholder="Enter checklist title"
                />
              </div>
              <div>
                <Label>Checklist Items (one per line)</Label>
                <Textarea
                  value={(config.items || []).join('\n')}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    items: e.target.value.split('\n').filter(line => line.trim()) 
                  })}
                  placeholder="Enter checklist items, one per line"
                  rows={6}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={config.priority || "medium"}
                  onValueChange={(value) => setConfig({ ...config, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          );

        case "create_note":
          return (
            <div className="space-y-4">
              <div>
                <Label>Note Content</Label>
                <Textarea
                  value={config.content || ""}
                  onChange={(e) => setConfig({ ...config, content: e.target.value })}
                  placeholder="Enter note content"
                  rows={6}
                />
              </div>
            </div>
          );

        case "update_ticket_status":
          return (
            <div className="space-y-4">
              <div>
                <Label>New Status</Label>
                <Select
                  value={config.newStatus || ""}
                  onValueChange={(value) => setConfig({ ...config, newStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting_customer">Waiting on Customer</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          );

        case "assign_ticket":
          return (
            <div className="space-y-4">
              <div>
                <Label>Assignment Type</Label>
                <Select
                  value={config.assignmentType || "current_user"}
                  onValueChange={(value) => setConfig({ ...config, assignmentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_user">Current User</SelectItem>
                    <SelectItem value="specific_user">Specific User</SelectItem>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {config.assignmentType === "specific_user" && (
                <div>
                  <Label>User ID</Label>
                  <Input
                    value={config.assignedTo || ""}
                    onChange={(e) => setConfig({ ...config, assignedTo: e.target.value })}
                    placeholder="Enter user ID"
                  />
                </div>
              )}
            </div>
          );

        case "send_helpdesk_email":
          return (
            <div className="space-y-4">
              <div>
                <Label>Email Subject</Label>
                <Input
                  value={config.subject || ""}
                  onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                  placeholder="Enter email subject"
                />
              </div>
              <div>
                <Label>Email Body</Label>
                <Textarea
                  value={config.body || ""}
                  onChange={(e) => setConfig({ ...config, body: e.target.value })}
                  placeholder="Enter email content"
                  rows={6}
                />
              </div>
              <div>
                <Label>To Email (optional - uses ticket contact)</Label>
                <Input
                  value={config.toEmail || ""}
                  onChange={(e) => setConfig({ ...config, toEmail: e.target.value })}
                  placeholder="Leave blank to use ticket contact email"
                />
              </div>
            </div>
          );

        case "assign_user":
          return (
            <div className="space-y-4">
              <div>
                <Label>Assignment Type</Label>
                <Select
                  value={config.assignment_type || "current_user"}
                  onValueChange={(value) => setConfig({ ...config, assignment_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_user">Current User</SelectItem>
                    <SelectItem value="specific_user">Specific User</SelectItem>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {config.assignment_type === "specific_user" && (
                <div>
                  <Label>User ID</Label>
                  <Input
                    value={config.user_id || ""}
                    onChange={(e) => setConfig({ ...config, user_id: e.target.value })}
                    placeholder="Enter user ID"
                  />
                </div>
              )}
            </div>
          );

        case "update_status":
          return (
            <div className="space-y-4">
              <div>
                <Label>New Status</Label>
                <Select
                  value={config.status || ""}
                  onValueChange={(value) => setConfig({ ...config, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={config.notes || ""}
                  onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                  placeholder="Status change notes"
                  rows={3}
                />
              </div>
            </div>
          );

        default:
          return (
            <div className="text-sm text-muted-foreground">
              No configuration options available for this action type.
            </div>
          );
      }
    }

    return null;
  };

  return (
    <Card className="absolute top-4 right-4 w-80 max-h-[calc(100vh-8rem)] overflow-y-auto p-4 shadow-lg z-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Configure Node</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-4">
        <div className="text-sm font-medium mb-2">{selectedNode.data.label}</div>
        <div className="text-xs text-muted-foreground uppercase">
          {selectedNode.type === "trigger" ? "TRIGGER" : selectedNode.type === "condition" ? "CONDITION" : "ACTION"}
        </div>
      </div>

      {renderConfigFields()}

      <div className="flex gap-2 mt-6">
        <Button onClick={handleSave} className="flex-1">
          Save Configuration
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
      
      {selectedNode.type !== "trigger" && (
        <div className="mt-4 pt-4 border-t">
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Node
          </Button>
        </div>
      )}
    </Card>
  );
}
