import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import TaskComments from "./TaskComments";
import TaskChecklist from "./TaskChecklist";
import TaskDependenciesTab from "./TaskDependenciesTab";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskFormData) => void;
  defaultValues?: Partial<TaskFormData>;
  linkedModule?: string;
  linkedRecordId?: string;
  linkedRecordName?: string;
  workers?: Array<{ id: string; first_name: string; last_name: string }>;
  taskId?: string;
}

export interface TaskFormData {
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | undefined;
  due_date: Date | undefined;
  start_date: Date | undefined;
  end_date: Date | undefined;
  estimated_hours: string;
  progress_percentage: string;
  tags: string[];
}

export default function TaskDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  linkedModule,
  linkedRecordId,
  linkedRecordName,
  workers = [],
  taskId,
}: TaskDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [previewChecklistItems, setPreviewChecklistItems] = useState<Array<{ title: string; item_order: number }>>([]);
  const [formData, setFormData] = useState<TaskFormData>({
    title: defaultValues?.title || "",
    description: defaultValues?.description || "",
    status: defaultValues?.status || "pending",
    priority: defaultValues?.priority || "medium",
    assigned_to: defaultValues?.assigned_to || undefined,
    due_date: defaultValues?.due_date,
    start_date: defaultValues?.start_date,
    end_date: defaultValues?.end_date,
    estimated_hours: defaultValues?.estimated_hours || "",
    progress_percentage: defaultValues?.progress_percentage || "0",
    tags: defaultValues?.tags || [],
  });
  
  const [tagInput, setTagInput] = useState("");

  // Fetch active task templates
  const { data: templates = [] } = useQuery({
    queryKey: ["task-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates" as any)
        .select("*, checklist:task_template_checklist_items(id, title, item_order)")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !taskId, // Only fetch when creating new task
  });

  // Reset form when defaultValues change (editing different task)
  useEffect(() => {
    if (defaultValues) {
      setFormData({
        title: defaultValues?.title || "",
        description: defaultValues?.description || "",
        status: defaultValues?.status || "pending",
        priority: defaultValues?.priority || "medium",
        assigned_to: defaultValues?.assigned_to || undefined,
        due_date: defaultValues?.due_date,
        start_date: defaultValues?.start_date,
        end_date: defaultValues?.end_date,
        estimated_hours: defaultValues?.estimated_hours || "",
        progress_percentage: defaultValues?.progress_percentage || "0",
        tags: defaultValues?.tags || [],
      });
    }
  }, [defaultValues, open]);

  // Apply template when selected
  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplate(templateId);
    const template: any = templates.find((t: any) => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.title || template.name || prev.title,
        description: template.description || prev.description,
        priority: template.default_priority || prev.priority,
        status: template.default_status || prev.status,
        estimated_hours: template.estimated_hours?.toString() || prev.estimated_hours,
        assigned_to: template.default_assigned_to || prev.assigned_to,
      }));
      
      // Load checklist items from template
      if (template.checklist && template.checklist.length > 0) {
        setPreviewChecklistItems(template.checklist.map((item: any) => ({
          title: item.title,
          item_order: item.item_order,
        })));
      } else {
        setPreviewChecklistItems([]);
      }
    }
  };

  const handleSubmit = async () => {
    // Store checklist items to be created with the task
    if (previewChecklistItems.length > 0 && !taskId) {
      (formData as any)._checklistItems = previewChecklistItems;
    }
    
    await onSubmit(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>
        
        {taskId ? (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className={cn(
              "grid w-full",
              linkedModule === 'project' ? "grid-cols-4" : "grid-cols-3"
            )}>
              <TabsTrigger value="details">Task Details</TabsTrigger>
              {linkedModule === 'project' && (
                <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
              )}
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="comments">Comments</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="space-y-4">
          <div>
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              placeholder="Enter task title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter task description"
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

            <div className="grid gap-4 md:grid-cols-2">
              {linkedModule === 'project' && (
                <>
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.start_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.start_date ? format(formData.start_date, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.start_date}
                          onSelect={(date) => setFormData({ ...formData, start_date: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.end_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.end_date ? format(formData.end_date, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.end_date}
                          onSelect={(date) => setFormData({ ...formData, end_date: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
            </div>

            <div className={cn(
              "grid gap-4",
              linkedModule === 'project' ? "md:grid-cols-3" : "md:grid-cols-1"
            )}>
              {linkedModule === 'project' && (
                <>
                  <div>
                    <Label>Estimated Hours</Label>
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="0"
                      value={formData.estimated_hours}
                      onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Progress (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={formData.progress_percentage}
                      onChange={(e) => setFormData({ ...formData, progress_percentage: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div>
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.due_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => setFormData({ ...formData, due_date: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select
                value={formData.assigned_to || "unassigned"}
                onValueChange={(value) => setFormData({ ...formData, assigned_to: value === "unassigned" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {workers.filter(w => w.id && w.id.trim()).map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.first_name} {worker.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    placeholder="Add tag and press Enter"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        if (!formData.tags.includes(tagInput.trim())) {
                          setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
                        }
                        setTagInput("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
                        setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
                        setTagInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, tags: formData.tags.filter((_, i) => i !== index) })}
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={!formData.title.trim()}>
                    {defaultValues ? "Update" : "Create"} Task
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            {linkedModule === 'project' && (
              <TabsContent value="dependencies" className="mt-4">
                {linkedRecordId && (
                  <TaskDependenciesTab taskId={taskId} projectId={linkedRecordId} />
                )}
              </TabsContent>
            )}
            
            <TabsContent value="checklist" className="mt-4">
              <TaskChecklist taskId={taskId} />
            </TabsContent>
            
            <TabsContent value="comments" className="mt-4">
              <TaskComments taskId={taskId} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            {templates.length > 0 && !defaultValues && (
              <div>
                <Label htmlFor="template">Use Template (Optional)</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={handleTemplateSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template: any) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            
            <div>
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="Enter task title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter task description"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="assigned_to">Assign To</Label>
                <Select
                  value={formData.assigned_to || "unassigned"}
                  onValueChange={(value) => setFormData({ ...formData, assigned_to: value === "unassigned" ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {workers.filter(w => w.id && w.id.trim()).map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.first_name} {worker.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.due_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => setFormData({ ...formData, due_date: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {previewChecklistItems.length > 0 && (
              <div className="space-y-2">
                <Label>Template Checklist Items</Label>
                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  {previewChecklistItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded border border-input bg-background" />
                      <span className="text-sm">{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {linkedModule && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Linked to: <span className="font-medium capitalize">{linkedModule.replace('_', ' ')}</span>
                  {linkedRecordName && <span className="font-medium"> - {linkedRecordName}</span>}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.title.trim()}>
                {defaultValues ? "Update" : "Create"} Task
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
