import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface WorkerTrainingTabProps {
  workerId: string;
}

export default function WorkerTrainingTab({ workerId }: WorkerTrainingTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    training_name: "",
    training_provider: "",
    completion_date: "",
    expiry_date: "",
    hours_completed: "",
    status: "completed",
    notes: "",
  });

  const { data: training = [], isLoading } = useQuery({
    queryKey: ["worker-training", workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_training")
        .select("*")
        .eq("worker_id", workerId)
        .order("completion_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const trainingData = {
        ...formData,
        worker_id: workerId,
        tenant_id: profile?.tenant_id,
        completion_date: formData.completion_date || null,
        expiry_date: formData.expiry_date || null,
        hours_completed: formData.hours_completed ? parseFloat(formData.hours_completed) : 0,
      };

      if (editingTraining) {
        const { error } = await supabase
          .from("worker_training")
          .update(trainingData)
          .eq("id", editingTraining.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("worker_training")
          .insert([trainingData]);
        if (error) throw error;
      }

      toast({
        title: editingTraining ? "Training updated" : "Training added",
      });
      queryClient.invalidateQueries({ queryKey: ["worker-training", workerId] });
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Error saving training",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("worker_training")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast({
        title: "Error deleting training",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Training deleted" });
      queryClient.invalidateQueries({ queryKey: ["worker-training", workerId] });
    }
    setDeleteId(null);
  };

  const resetForm = () => {
    setFormData({
      training_name: "",
      training_provider: "",
      completion_date: "",
      expiry_date: "",
      hours_completed: "",
      status: "completed",
      notes: "",
    });
    setEditingTraining(null);
  };

  const openEdit = (training: any) => {
    setEditingTraining(training);
    setFormData({
      training_name: training.training_name || "",
      training_provider: training.training_provider || "",
      completion_date: training.completion_date || "",
      expiry_date: training.expiry_date || "",
      hours_completed: training.hours_completed?.toString() || "",
      status: training.status || "completed",
      notes: training.notes || "",
    });
    setDialogOpen(true);
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTraining ? "Edit" : "Add"} Training</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="training_name">Training Name *</Label>
                <Input
                  id="training_name"
                  value={formData.training_name}
                  onChange={(e) =>
                    setFormData({ ...formData, training_name: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="training_provider">Training Provider</Label>
                <Input
                  id="training_provider"
                  value={formData.training_provider}
                  onChange={(e) =>
                    setFormData({ ...formData, training_provider: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="hours_completed">Hours Completed</Label>
                <Input
                  id="hours_completed"
                  type="number"
                  step="0.5"
                  value={formData.hours_completed}
                  onChange={(e) =>
                    setFormData({ ...formData, hours_completed: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="completion_date">Completion Date</Label>
                <Input
                  id="completion_date"
                  type="date"
                  value={formData.completion_date}
                  onChange={(e) =>
                    setFormData({ ...formData, completion_date: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="expiry_date">Expiry Date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) =>
                    setFormData({ ...formData, expiry_date: e.target.value })
                  }
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.training_name}>
                {editingTraining ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this training record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Training Records</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Training
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : training.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No training records added yet
            </div>
          ) : (
            <div className="space-y-3">
              {training.map((train: any) => (
                <div
                  key={train.id}
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{train.training_name}</div>
                      <Badge
                        variant={
                          train.status === "completed" ? "default" : "secondary"
                        }
                      >
                        {train.status}
                      </Badge>
                    </div>
                    {train.training_provider && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {train.training_provider}
                      </div>
                    )}
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      {train.completion_date && (
                        <span>
                          Completed: {format(new Date(train.completion_date), "MMM d, yyyy")}
                        </span>
                      )}
                      {train.hours_completed > 0 && (
                        <span>{train.hours_completed} hours</span>
                      )}
                    </div>
                    {train.expiry_date && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Expires: {format(new Date(train.expiry_date), "MMM d, yyyy")}
                      </div>
                    )}
                    {train.notes && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {train.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(train)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(train.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
