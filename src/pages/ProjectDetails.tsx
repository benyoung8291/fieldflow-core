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
import { ArrowLeft, Calendar, DollarSign, TrendingUp, ClipboardList, FileText, Folder, UserPlus, GitCompare, History, Plus } from "lucide-react";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import ProjectGanttChart from "@/components/projects/ProjectGanttChart";
import ProjectRosterTab from "@/components/projects/ProjectRosterTab";
import ProjectFilesTab from "@/components/projects/ProjectFilesTab";
import ProjectContractsTab from "@/components/projects/ProjectContractsTab";
import ProjectChangeOrdersTab from "@/components/projects/ProjectChangeOrdersTab";
import ProjectFinanceTab from "@/components/projects/ProjectFinanceTab";
import AuditDrawer from "@/components/audit/AuditDrawer";
import AuditTimeline from "@/components/audit/AuditTimeline";
import InlineProjectDetails from "@/components/projects/InlineProjectDetails";
import ProjectTasksGrid from "@/components/projects/ProjectTasksGrid";
import RelatedInvoicesCard from "@/components/invoices/RelatedInvoicesCard";
import { format } from "date-fns";

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

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

  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks" as any)
        .select("*")
        .eq("project_id", id)
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!project,
  });

  const { data: taskDependencies } = useQuery({
    queryKey: ["project-task-dependencies", id],
    queryFn: async () => {
      if (!tasks?.length) return [];
      
      const taskIds = tasks.map((t: any) => t.id);
      const { data, error } = await supabase
        .from("project_task_dependencies" as any)
        .select("*")
        .in("project_task_id", taskIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tasks?.length && !!project,
  });

  // Prepare tasks for Gantt chart - use project tasks with dependencies
  const ganttTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];
    
    // Map project tasks to Gantt format
    return tasks.map((task: any) => ({
      id: task.id,
      name: task.title,
      start_date: task.start_date,
      end_date: task.end_date,
      status: task.status,
      progress: task.progress_percentage || 0,
    }));
  }, [tasks]);

  // Map dependencies to correct format
  const ganttDependencies = useMemo(() => {
    if (!taskDependencies || taskDependencies.length === 0) return [];
    
    return taskDependencies.map((dep: any) => ({
      id: dep.id,
      task_id: dep.project_task_id,
      depends_on_task_id: dep.depends_on_task_id,
      dependency_type: dep.dependency_type,
      lag_days: dep.lag_days,
    }));
  }, [taskDependencies]);

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
  
  // Calculate revenue budget details
  const originalBudget = project.original_budget || project.budget || 0;
  const revisedBudget = project.revised_budget || originalBudget;
  const changeOrdersTotal = project.total_change_orders || 0;
  const invoicedToDate = project.invoiced_to_date || 0;
  const wipTotal = project.wip_total || 0;
  const labourCostTotal = project.labour_cost_total || 0;
  const budgetVariance = originalBudget > 0 ? ((project.actual_cost / originalBudget) * 100) - 100 : 0;

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
          <CreateTaskButton
            linkedModule="project"
            linkedRecordId={id!}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-6">
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
              <CardTitle className="text-sm font-medium">Revenue Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${revisedBudget.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Original: ${originalBudget.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Change Orders</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${changeOrdersTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${Math.abs(changeOrdersTotal).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {changeOrdersTotal >= 0 ? 'Addition' : 'Reduction'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invoiced</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${invoicedToDate.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                To date
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">WIP</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${wipTotal.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Work in Progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Labour Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${labourCostTotal.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total labour
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="finance">
              <DollarSign className="h-4 w-4 mr-2" />
              Finance
            </TabsTrigger>
            <TabsTrigger value="gantt">
              <Calendar className="h-4 w-4 mr-2" />
              Gantt Chart
            </TabsTrigger>
            <TabsTrigger value="roster">
              <UserPlus className="h-4 w-4 mr-2" />
              Roster
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <ClipboardList className="h-4 w-4 mr-2" />
              Project Tasks ({tasks?.length || 0})
            </TabsTrigger>
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
            <TabsTrigger value="invoices">
              <DollarSign className="h-4 w-4 mr-2" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <InlineProjectDetails project={project} />
          </TabsContent>

          <TabsContent value="finance">
            <ProjectFinanceTab projectId={id!} />
          </TabsContent>

          <TabsContent value="tasks">
            <ProjectTasksGrid projectId={id!} />
          </TabsContent>

          <TabsContent value="gantt">
            <ProjectGanttChart 
              tasks={ganttTasks}
              dependencies={ganttDependencies}
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

          <TabsContent value="invoices">
            <RelatedInvoicesCard sourceType="project" sourceId={id!} />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Change History</CardTitle>
              </CardHeader>
              <CardContent>
                <AuditTimeline tableName="projects" recordId={id!} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

