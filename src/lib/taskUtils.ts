import { format, isPast, isToday } from "date-fns";

// Status Configuration
export const statusConfig = {
  pending: {
    label: "Pending",
    icon: "Circle",
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    className: "text-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    icon: "Clock",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    className: "text-info",
  },
  completed: {
    label: "Completed",
    icon: "CheckCircle2",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    className: "text-success",
  },
  cancelled: {
    label: "Cancelled",
    icon: "Circle",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    className: "text-muted-foreground",
  },
};

// Project task status (normalized to system task status for display)
export const projectStatusConfig = {
  not_started: {
    label: "Not Started",
    icon: "Circle",
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    className: "text-muted-foreground",
    normalizedStatus: "pending" as const,
  },
  in_progress: {
    label: "In Progress",
    icon: "Clock",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    className: "text-info",
    normalizedStatus: "in_progress" as const,
  },
  completed: {
    label: "Completed",
    icon: "CheckCircle2",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    className: "text-success",
    normalizedStatus: "completed" as const,
  },
};

// Priority Configuration
export const priorityConfig = {
  low: {
    label: "Low",
    color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    className: "bg-muted text-muted-foreground border-muted",
  },
  medium: {
    label: "Medium",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    className: "bg-warning/20 text-warning border-warning/30",
  },
  high: {
    label: "High",
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    className: "bg-destructive/20 text-destructive border-destructive/30",
  },
  urgent: {
    label: "Urgent",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    className: "bg-destructive text-destructive-foreground border-destructive",
  },
};

// Module Route Mapping
export const getModuleRoute = (module: string, id: string): string => {
  const routes: Record<string, string> = {
    customer: `/customers/${id}`,
    lead: `/leads/${id}`,
    project: `/projects/${id}`,
    quote: `/quotes/${id}`,
    service_order: `/service-orders/${id}`,
    appointment: `/appointments/${id}`,
    invoice: `/invoices/${id}`,
    contract: `/service-contracts/${id}`,
  };
  return routes[module] || '#';
};

// Module to Table Mapping
export const getModuleTableConfig = (module: string): { tableName: string; nameField: string } => {
  const configs: Record<string, { tableName: string; nameField: string }> = {
    service_order: { tableName: 'service_orders', nameField: 'title' },
    quote: { tableName: 'quotes', nameField: 'title' },
    project: { tableName: 'projects', nameField: 'name' },
    customer: { tableName: 'customers', nameField: 'name' },
    lead: { tableName: 'leads', nameField: 'name' },
    appointment: { tableName: 'appointments', nameField: 'title' },
    invoice: { tableName: 'invoices', nameField: 'invoice_number' },
    contract: { tableName: 'service_contracts', nameField: 'name' },
  };
  return configs[module] || { tableName: module, nameField: 'name' };
};

// Format Document Type for Display
export const formatDocumentType = (module: string): string => {
  return module
    .replace('_', ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Overdue Detection
export const isTaskOverdue = (dueDate: string | null, status: string): boolean => {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false;
  const date = new Date(dueDate);
  return isPast(date) && !isToday(date);
};

// Format Due Date with Status
export const getDueDateLabel = (dueDate: string | null, status: string) => {
  if (!dueDate) return null;
  
  const date = new Date(dueDate);
  if (isTaskOverdue(dueDate, status)) {
    return { label: "Overdue", className: "text-destructive" };
  }
  if (isToday(date)) {
    return { label: "Due Today", className: "text-warning" };
  }
  return { label: format(date, "MMM d, yyyy"), className: "text-muted-foreground" };
};

// Normalize Project Task Status to System Status
export const normalizeProjectStatus = (status: string): string => {
  if (status === 'not_started') return 'pending';
  return status;
};

// Get Status Configuration (handles both system and project tasks)
export const getStatusConfig = (status: string, isProjectTask: boolean = false) => {
  if (isProjectTask && status === 'not_started') {
    return projectStatusConfig.not_started;
  }
  return statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
};

// Sort Tasks by Overdue, then Priority
export const sortTasksByUrgency = (tasks: any[]) => {
  return [...tasks].sort((a, b) => {
    // First: overdue tasks
    const aOverdue = isTaskOverdue(a.due_date, a.status);
    const bOverdue = isTaskOverdue(b.due_date, b.status);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Then: by priority
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
    return bPriority - aPriority;
  });
};

// Status Labels for Display
export const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  not_started: "Not Started",
};
