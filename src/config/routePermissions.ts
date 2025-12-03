import { Module } from "@/hooks/usePermissions";

/**
 * Maps application routes to their required modules for permission checks.
 * Routes with null values are accessible to all authenticated users.
 * Routes with module values require the user to have "view" permission for that module.
 */
export const ROUTE_MODULE_MAP: Record<string, Module | null> = {
  // Always accessible
  "/": null,
  "/dashboard": null,
  "/profile": null,
  "/chat": null,
  
  // Core modules
  "/quotes": "quotes",
  "/quote-pipeline": "quotes",
  "/pipeline": "quotes",
  "/customers": "customers",
  "/leads": "leads",
  "/contacts": "contacts",
  "/crm": "leads",
  
  // Service management
  "/service-orders": "service_orders",
  "/service-contracts": "service_contracts",
  "/appointments": "appointments",
  "/scheduler": "appointments",
  "/field-reports": "field_reports",
  
  // Projects and tasks
  "/projects": "projects",
  "/tasks": "tasks",
  
  // Worker management
  "/workers": "workers",
  "/timesheets": "timesheets",
  "/skills": "workers",
  "/training-matrix": "workers",
  
  // Financial
  "/invoices": "invoices",
  "/recurring-invoices": "invoices",
  "/expenses": "expenses",
  "/credit-card-reconciliation": "expenses",
  "/unassigned-transactions": "expenses",
  "/purchase-orders": "purchase_orders",
  "/suppliers": "suppliers",
  "/ap-invoices": "ap_invoices",
  "/ap-invoice-approval-queue": "ap_invoices",
  "/financial-reconciliation": "invoices",
  
  // Support and automation
  "/helpdesk": "helpdesk",
  "/helpdesk-analytics": "helpdesk",
  "/workflows": "workflows",
  "/workflow-template-selector": "workflows",
  "/knowledge-base": "knowledge_base",
  
  // Analytics and reports
  "/analytics": "analytics",
  "/reports": "reports",
  
  // Configuration
  "/settings": "settings",
  "/users": "user_management",
  "/integrations": "integrations",
  
  // Worker portal routes - accessible to workers
  "/worker": null,
  "/worker/appointments": null,
  "/worker/tasks": null,
  "/worker/time-logs": null,
  "/worker/schedule": null,
  "/worker/calendar": null,
  "/worker/profile": null,
  "/worker/field-report": null,
  
  // Supervisor routes - accessible to supervisors
  "/supervisor": null,
  "/supervisor/map": null,
  "/supervisor/appointments": null,
  "/supervisor/service-orders": null,
  
  // Customer portal routes - accessible to portal users
  "/customer": null,
  "/customer/locations": null,
  "/customer/requests": null,
};

/**
 * Get the required module for a given route path
 */
export function getRouteModule(path: string): Module | null {
  // Check exact match first
  if (path in ROUTE_MODULE_MAP) {
    return ROUTE_MODULE_MAP[path];
  }
  
  // Check for dynamic routes (e.g., /quotes/:id)
  for (const [route, module] of Object.entries(ROUTE_MODULE_MAP)) {
    if (path.startsWith(route + "/")) {
      return module;
    }
  }
  
  // Default: no module required (accessible to all)
  return null;
}
