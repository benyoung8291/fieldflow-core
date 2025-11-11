import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, DollarSign, ClipboardList, FileText, Folder, UserPlus, GitCompare, History, Receipt, Edit, Copy, Trash2 } from "lucide-react";
import DocumentDetailLayout, { DocumentAction, FileMenuAction, StatusBadge, TabConfig } from "@/components/layout/DocumentDetailLayout";
import KeyInfoCard from "@/components/layout/KeyInfoCard";
import CreateTaskButton from "@/components/tasks/CreateTaskButton";
import LinkedTasksList from "@/components/tasks/LinkedTasksList";
import ProjectGanttChart from "@/components/projects/ProjectGanttChart";
import ProjectRosterTab from "@/components/projects/ProjectRosterTab";
import ProjectFilesTab from "@/components/projects/ProjectFilesTab";
import ProjectContractsTab from "@/components/projects/ProjectContractsTab";
import ProjectChangeOrdersTab from "@/components/projects/ProjectChangeOrdersTab";
import ProjectFinanceTab from "@/components/projects/ProjectFinanceTab";
import AuditTimeline from "@/components/audit/AuditTimeline";
import InlineProjectDetails from "@/components/projects/InlineProjectDetails";
import ProjectTasksGrid from "@/components/projects/ProjectTasksGrid";
import RelatedInvoicesCard from "@/components/invoices/RelatedInvoicesCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const originalBudget = project?.original_budget || project?.budget || 0;
  const revisedBudget = project?.revised_budget || originalBudget;
  const changeOrdersTotal = project?.total_change_orders || 0;
  const invoicedToDate = project?.invoiced_to_date || 0;
  const wipTotal = project?.wip_total || 0;
  const labourCostTotal = project?.labour_cost_total || 0;
  const budgetVariance = originalBudget > 0 ? ((project?.actual_cost || 0) / originalBudget) * 100 - 100 : 0;

  // Status badge configuration
  const statusBadges: StatusBadge[] = [
    {
      label: project?.status.replace("_", " ") || "",
      variant: "outline",
      className: statusColors[project?.status || "planning"],
    },
  ];

  // Primary action buttons
  const primaryActions: DocumentAction[] = [
    {
      label: "Create Invoice",
      icon: <Receipt className="h-4 w-4" />,
      onClick: () => navigate("/invoices/create", { state: { projectId: id } }),
      variant: "outline",
    },
  ];

  // File menu actions
  const fileMenuActions: FileMenuAction[] = [
    {
      label: "Edit Project",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => {/* Open edit dialog */},
    },
    {
      label: "Duplicate",
      icon: <Copy className="h-4 w-4" />,
      onClick: () => {/* Duplicate project */},
    },
    {
      label: "Change Status",
      onClick: () => {/* Change status dialog */},
      separator: true,
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => {/* Delete confirmation */},
      destructive: true,
      separator: true,
    },
  ];

  // Key information cards
  const keyInfoSection = (
    <div className="grid gap-4 md:grid-cols-3">
      <KeyInfoCard
        icon={DollarSign}
        label="Revenue Budget"
        value={`$${revisedBudget.toLocaleString()}`}
        description={`Original: $${originalBudget.toLocaleString()}`}
      />
      <KeyInfoCard
        icon={DollarSign}
        label="WIP"
        value={`$${wipTotal.toLocaleString()}`}
        description="Work in Progress"
      />
      <KeyInfoCard
        icon={DollarSign}
        label="Billed to Date"
        value={`$${invoicedToDate.toLocaleString()}`}
        description="Invoiced amount"
      />
    </div>
  );

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      value: "overview",
      label: "Overview",
      content: <InlineProjectDetails project={project!} />,
    },
    {
      value: "finance",
      label: "Finance",
      icon: <DollarSign className="h-4 w-4" />,
      content: <ProjectFinanceTab projectId={id!} />,
    },
    {
      value: "gantt",
      label: "Gantt Chart",
      icon: <Calendar className="h-4 w-4" />,
      content: (
        <ProjectGanttChart
          tasks={ganttTasks}
          dependencies={ganttDependencies}
          projectStart={project?.start_date}
          projectEnd={project?.end_date}
        />
      ),
    },
    {
      value: "roster",
      label: "Roster",
      icon: <UserPlus className="h-4 w-4" />,
      content: <ProjectRosterTab projectId={id!} />,
    },
    {
      value: "tasks",
      label: "Project Tasks",
      icon: <ClipboardList className="h-4 w-4" />,
      badge: tasks?.length || 0,
      content: <ProjectTasksGrid projectId={id!} />,
    },
    {
      value: "files",
      label: "Files",
      icon: <Folder className="h-4 w-4" />,
      content: <ProjectFilesTab projectId={id!} />,
    },
    {
      value: "contracts",
      label: "Contracts",
      icon: <FileText className="h-4 w-4" />,
      content: <ProjectContractsTab projectId={id!} />,
    },
    {
      value: "change-orders",
      label: "Change Orders",
      icon: <GitCompare className="h-4 w-4" />,
      content: <ProjectChangeOrdersTab projectId={id!} />,
    },
    {
      value: "invoices",
      label: "Invoices",
      icon: <DollarSign className="h-4 w-4" />,
      content: <RelatedInvoicesCard sourceType="project" sourceId={id!} />,
    },
    {
      value: "history",
      label: "History",
      icon: <History className="h-4 w-4" />,
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Change History</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTimeline tableName="projects" recordId={id!} />
          </CardContent>
        </Card>
      ),
    },
  ];

  return (
    <DocumentDetailLayout
      title={project?.name || ""}
      subtitle={project?.customer?.name}
      backPath="/projects"
      statusBadges={statusBadges}
      primaryActions={primaryActions}
      fileMenuActions={fileMenuActions}
      auditTableName="projects"
      auditRecordId={id!}
      keyInfoSection={keyInfoSection}
      tabs={tabs}
      defaultTab="overview"
      isLoading={isLoading}
      notFoundMessage={!project ? "Project not found" : undefined}
    />
  );
}

