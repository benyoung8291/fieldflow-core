import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Users, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AVAILABLE_MODULES = [
  { value: "projects", label: "Projects" },
  { value: "service_orders", label: "Service Orders" },
  { value: "appointments", label: "Appointments" },
  { value: "field_reports", label: "Field Reports" },
  { value: "customers", label: "Customers" },
  { value: "contacts", label: "Contacts" },
  { value: "leads", label: "Leads" },
  { value: "quotes", label: "Quotes" },
  { value: "invoicing", label: "Invoicing" },
  { value: "expenses", label: "Expenses" },
  { value: "purchase_orders", label: "Purchase Orders" },
  { value: "inventory", label: "Inventory" },
  { value: "helpdesk", label: "Help Desk" },
];

export function TeamsTab() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      
      const { data, error } = await supabase
        .from("teams")
        .select("*, user_teams(count)")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const createTeamMutation = useMutation({
    mutationFn: async (teamData: { name: string; description: string; enabled_modules: string[] }) => {
      const { error } = await supabase
        .from("teams")
        .insert({
          ...teamData,
          tenant_id: profile!.tenant_id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team created successfully");
      resetForm();
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to create team: " + error.message);
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, ...teamData }: { id: string; name: string; description: string; enabled_modules: string[] }) => {
      const { error } = await supabase
        .from("teams")
        .update(teamData)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team updated successfully");
      resetForm();
      setEditingTeam(null);
    },
    onError: (error) => {
      toast.error("Failed to update team: " + error.message);
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", teamId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Team deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete team: " + error.message);
    },
  });

  const resetForm = () => {
    setTeamName("");
    setTeamDescription("");
    setSelectedModules([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTeam) {
      updateTeamMutation.mutate({
        id: editingTeam.id,
        name: teamName,
        description: teamDescription,
        enabled_modules: selectedModules,
      });
    } else {
      createTeamMutation.mutate({
        name: teamName,
        description: teamDescription,
        enabled_modules: selectedModules,
      });
    }
  };

  const handleEdit = (team: any) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamDescription(team.description || "");
    setSelectedModules(team.enabled_modules || []);
    setCreateDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setEditingTeam(null);
      resetForm();
    }
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setEditingTeam(null);
    resetForm();
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Teams</h2>
          <p className="text-muted-foreground">
            Organize users into teams with specific module access and workflows
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTeam ? "Edit Team" : "Create New Team"}</DialogTitle>
              <DialogDescription>
                Define a team with specific modules and workflows
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Team Name</Label>
                <Input
                  id="name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., Cleaning Team, Projects Team"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="Describe this team's role and responsibilities"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Enabled Modules</Label>
                <p className="text-sm text-muted-foreground">
                  Select which modules this team can access
                </p>
                <div className="grid grid-cols-2 gap-4 border rounded-lg p-4">
                  {AVAILABLE_MODULES.map((module) => (
                    <div key={module.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={module.value}
                        checked={selectedModules.includes(module.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedModules([...selectedModules, module.value]);
                          } else {
                            setSelectedModules(selectedModules.filter((m) => m !== module.value));
                          }
                        }}
                      />
                      <label
                        htmlFor={module.value}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {module.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTeam ? "Update Team" : "Create Team"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {teams?.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>{team.name}</CardTitle>
                    <CardDescription>{team.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {team.user_teams?.[0]?.count || 0} members
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(team)}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Delete team "${team.name}"?`)) {
                        deleteTeamMutation.mutate(team.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">Enabled Modules:</p>
                <div className="flex flex-wrap gap-2">
                  {team.enabled_modules?.length > 0 ? (
                    team.enabled_modules.map((module: string) => (
                      <Badge key={module} variant="outline">
                        {AVAILABLE_MODULES.find((m) => m.value === module)?.label || module}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No modules configured</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {teams?.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No teams yet</p>
              <p className="text-muted-foreground text-center mb-4">
                Create your first team to organize users and define workflows
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Team
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
