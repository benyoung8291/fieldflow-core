import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Calendar, DollarSign, TrendingUp } from "lucide-react";
import ProjectDialog from "@/components/projects/ProjectDialog";
import { format } from "date-fns";
import { useViewMode } from "@/contexts/ViewModeContext";
import { MobileDocumentCard } from "@/components/mobile/MobileDocumentCard";

export default function Projects() {
  const navigate = useNavigate();
  const { isMobile } = useViewMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch related data
      const projectsWithDetails = await Promise.all((data || []).map(async (project: any) => {
        const { data: customer } = await supabase
          .from("customers")
          .select("name")
          .eq("id", project.customer_id)
          .single();
        
        const { data: creator } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", project.created_by)
          .single();

        return { ...project, customer, creator };
      }));

      return projectsWithDetails;
    },
  });

  const filteredProjects = projects?.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.customer?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    planning: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    on_hold: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const handleCreateProject = () => {
    setSelectedProjectId(undefined);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Projects</h1>
            <p className="text-muted-foreground">Manage and track your projects</p>
          </div>
          <Button onClick={handleCreateProject}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : filteredProjects?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No projects found</p>
              <Button onClick={handleCreateProject}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : isMobile ? (
          <div className="space-y-3">
            {filteredProjects?.map((project) => (
              <MobileDocumentCard
                key={project.id}
                title={project.name}
                subtitle={project.customer?.name}
                status={project.status.replace("_", " ")}
                statusColor={statusColors[project.status]}
                onClick={() => navigate(`/projects/${project.id}`)}
                metadata={[
                  {
                    label: "Start Date",
                    value: project.start_date 
                      ? format(new Date(project.start_date), "MMM d, yyyy")
                      : "Not set",
                  },
                  {
                    label: "Progress",
                    value: `${project.progress}%`,
                  },
                ]}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects?.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2">{project.name}</CardTitle>
                    <Badge variant="outline" className={statusColors[project.status]}>
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{project.customer?.name}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>

                  {project.budget && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Budget:</span>
                      <span className="font-medium">${project.budget.toLocaleString()}</span>
                    </div>
                  )}

                  {project.start_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {format(new Date(project.start_date), "MMM d, yyyy")}
                        {project.end_date && ` - ${format(new Date(project.end_date), "MMM d, yyyy")}`}
                      </span>
                    </div>
                  )}

                  {project.actual_cost > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Actual:</span>
                      <span className="font-medium">${project.actual_cost.toLocaleString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={selectedProjectId}
      />
    </DashboardLayout>
  );
}
