import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Calendar, DollarSign, TrendingUp, ClipboardList, Users, FileText, Folder, UserPlus, GitCompare } from "lucide-react";
import ProjectDialog from "@/components/projects/ProjectDialog";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import ProjectGanttChart from "@/components/projects/ProjectGanttChart";
import ProjectRosterTab from "@/components/projects/ProjectRosterTab";
import ProjectFilesTab from "@/components/projects/ProjectFilesTab";
import ProjectContractsTab from "@/components/projects/ProjectContractsTab";
import ProjectChangeOrdersTab from "@/components/projects/ProjectAttachmentsTab";
import AuditDrawer from "@/components/audit/AuditDrawer";
import { format } from "date-fns";

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Fetch related data
      const { data: customer } = await supabase
        .from("customers")
        .select("id, name, email, phone")
        .eq("id", data.customer_id)
        .single();
      
      const { data: creator } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", data.created_by)
        .single();

      return { ...data, customer, creator };
    },
  });

  const { data: serviceOrders } = useQuery({
    queryKey: ["project-service-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch assigned users
      const ordersWithAssigned = await Promise.all((data || []).map(async (order: any) => {
        if (!order.assigned_to) return { ...order, assigned: null };
        
        const { data: assigned } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", order.assigned_to)
          .single();

        return { ...order, assigned };
      }));

      return ordersWithAssigned;
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ["project-appointments", id],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("service_orders")
        .select("id")
        .eq("project_id", id);

      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map((o: any) => o.id);
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .in("service_order_id", orderIds)
        .order("start_time", { ascending: true });

      if (error) throw error;
      
      // Fetch assigned users
      const appointmentsWithAssigned = await Promise.all((data || []).map(async (apt: any) => {
        if (!apt.assigned_to) return { ...apt, assigned: null };
        
        const { data: assigned } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", apt.assigned_to)
          .single();

        return { ...apt, assigned };
      }));

      return appointmentsWithAssigned;
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Project not found</p>
          <Button onClick={() => navigate("/projects")} className="mt-4">
            Back to Projects
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const statusColors: Record<string, string> = {
    planning: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    on_hold: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    completed: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const totalServiceOrders = serviceOrders?.length || 0;
  const completedServiceOrders = serviceOrders?.filter(so => so.status === 'completed').length || 0;
  const budgetVariance = project.budget ? ((project.actual_cost / project.budget) * 100) - 100 : 0;

  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks" as any)
        .select("*")
        .eq("linked_module", "project")
        .eq("linked_record_id", id)
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: taskDependencies } = useQuery({
    queryKey: ["task-dependencies", "project", id],
    queryFn: async () => {
      if (!tasks?.length) return [];
      
      const taskIds = tasks.map((t: any) => t.id);
      const { data, error } = await supabase
        .from("task_dependencies")
        .select("*")
        .in("task_id", taskIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tasks?.length,
  });

  // Prepare tasks for Gantt chart - use actual project tasks
  const ganttTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      // Fallback to service orders if no tasks
      return serviceOrders?.map(so => ({
        id: so.id,
        name: so.title,
        start_date: so.preferred_date || so.created_at,
        end_date: so.date_range_end || so.preferred_date || so.created_at,
        status: so.status,
        progress: 0,
      })) || [];
    }
    
    // Use project tasks with proper dates
    return tasks.filter((t: any) => t.start_date && t.end_date).map((task: any) => ({
      id: task.id,
      name: task.title,
      start_date: task.start_date,
      end_date: task.end_date,
      status: task.status,
      progress: task.progress_percentage || 0,
    }));
  }, [tasks, serviceOrders]);

  return (
    <DashboardLayout>
      <AuditDrawer
        tableName="projects"
        recordId={id!}
        recordTitle={project.name}
      />
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
              <Badge variant="outline" className={statusColors[project.status]}>
                {project.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground">{project.customer?.name}</p>
          </div>
          <div className="flex gap-2">
            <CreateTaskButton
              linkedModule="project"
              linkedRecordId={id!}
              variant="outline"
            />
            <Button onClick={() => setDialogOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Project
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.progress}%</div>
              <Progress value={project.progress} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${project.budget?.toLocaleString() || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Actual: ${project.actual_cost?.toLocaleString() || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Service Orders</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalServiceOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {completedServiceOrders} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Variance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${budgetVariance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {budgetVariance > 0 ? '+' : ''}{budgetVariance.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Budget variance</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="gantt">
              <Calendar className="h-4 w-4 mr-2" />
              Gantt Chart
            </TabsTrigger>
            <TabsTrigger value="roster">
              <UserPlus className="h-4 w-4 mr-2" />
              Roster
            </TabsTrigger>
            <TabsTrigger value="service-orders">Service Orders ({totalServiceOrders})</TabsTrigger>
            <TabsTrigger value="appointments">Appointments ({appointments?.length || 0})</TabsTrigger>
            <TabsTrigger value="files">
              <Folder className="h-4 w-4 mr-2" />
              Files
            </TabsTrigger>
            <TabsTrigger value="contracts">
              <FileText className="h-4 w-4 mr-2" />
              Contracts
            </TabsTrigger>
            <TabsTrigger value="change-orders">
              <GitCompare className="h-4 w-4 mr-2" />
              Change Orders
            </TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.description && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {project.start_date && (
                    <div>
                      <Label className="text-sm font-medium">Start Date</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(project.start_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  )}

                  {project.end_date && (
                    <div>
                      <Label className="text-sm font-medium">End Date</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(project.end_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  )}
                </div>

                {project.notes && (
                  <div>
                    <Label className="text-sm font-medium">Notes</Label>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {project.notes}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Created By</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {project.creator?.first_name} {project.creator?.last_name} on{" "}
                    {format(new Date(project.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="service-orders" className="space-y-4">
            {serviceOrders && serviceOrders.length > 0 ? (
              <div className="space-y-3">
                {serviceOrders.map((order) => (
                  <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate("/service-orders")}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{order.title}</p>
                            <Badge variant="outline">{order.status}</Badge>
                            {order.priority && (
                              <Badge variant="outline">{order.priority}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Order #{order.order_number}
                          </p>
                        </div>
                        {order.assigned && (
                          <div className="text-sm text-muted-foreground">
                            Assigned to: {order.assigned.first_name} {order.assigned.last_name}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No service orders yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="space-y-4">
            {appointments && appointments.length > 0 ? (
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <Card key={apt.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{apt.title}</p>
                            <Badge variant="outline">{apt.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(apt.start_time), "MMM d, yyyy h:mm a")} -{" "}
                            {format(new Date(apt.end_time), "h:mm a")}
                          </p>
                        </div>
                        {apt.assigned && (
                          <div className="text-sm text-muted-foreground">
                            {apt.assigned.first_name} {apt.assigned.last_name}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No appointments scheduled</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="gantt">
            <ProjectGanttChart 
              tasks={ganttTasks}
              dependencies={taskDependencies || []}
              projectStart={project.start_date}
              projectEnd={project.end_date}
            />
          </TabsContent>

          <TabsContent value="roster">
            <ProjectRosterTab projectId={id!} />
          </TabsContent>

          <TabsContent value="files">
            <ProjectFilesTab projectId={id!} />
          </TabsContent>

          <TabsContent value="contracts">
            <ProjectContractsTab projectId={id!} />
          </TabsContent>

          <TabsContent value="change-orders">
            <ProjectChangeOrdersTab projectId={id!} />
          </TabsContent>

          <TabsContent value="tasks">
            <LinkedTasksList linkedModule="project" linkedRecordId={id!} />
          </TabsContent>
        </Tabs>
      </div>

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} projectId={id} />
    </DashboardLayout>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}
