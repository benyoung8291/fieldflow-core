import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ProjectRosterTabProps {
  projectId: string;
}

export default function ProjectRosterTab({ projectId }: ProjectRosterTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string>("");
  const [role, setRole] = useState("team_member");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: projectWorkers, isLoading } = useQuery({
    queryKey: ["project-workers", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_workers")
        .select(`
          *,
          worker:profiles(id, first_name, last_name, email, phone)
        `)
        .eq("project_id", projectId)
        .order("assigned_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: availableWorkers } = useQuery({
    queryKey: ["available-project-workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, projects_enabled")
        .eq("projects_enabled", true)
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      return data;
    },
  });

  const addWorkerMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase.from("project_workers").insert({
        tenant_id: profile.tenant_id,
        project_id: projectId,
        worker_id: selectedWorker,
        role,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        notes,
        assigned_by: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-workers", projectId] });
      toast.success("Worker added to project roster");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add worker");
    },
  });

  const removeWorkerMutation = useMutation({
    mutationFn: async (workerId: string) => {
      const { error } = await supabase
        .from("project_workers")
        .delete()
        .eq("id", workerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-workers", projectId] });
      toast.success("Worker removed from project");
    },
    onError: () => {
      toast.error("Failed to remove worker");
    },
  });

  const resetForm = () => {
    setSelectedWorker("");
    setRole("team_member");
    setHourlyRate("");
    setNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) {
      toast.error("Please select a worker");
      return;
    }
    addWorkerMutation.mutate();
  };

  const roleLabels: Record<string, string> = {
    team_member: "Team Member",
    lead: "Lead",
    supervisor: "Supervisor",
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Project Roster</h3>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Worker
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Worker to Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Worker *</Label>
                  <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select worker" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWorkers?.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.first_name} {worker.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team_member">Team Member</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Hourly Rate (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addWorkerMutation.isPending}>
                    {addWorkerMutation.isPending ? "Adding..." : "Add Worker"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading roster...</div>
        ) : projectWorkers && projectWorkers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectWorkers.map((pw) => (
                <TableRow key={pw.id}>
                  <TableCell className="font-medium">
                    {pw.worker?.first_name} {pw.worker?.last_name}
                  </TableCell>
                  <TableCell>{pw.worker?.email}</TableCell>
                  <TableCell>{pw.worker?.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{roleLabels[pw.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    {pw.hourly_rate ? `$${pw.hourly_rate}/hr` : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pw.is_active ? "default" : "secondary"}>
                      {pw.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Remove this worker from the project?")) {
                          removeWorkerMutation.mutate(pw.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No workers assigned to this project yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}