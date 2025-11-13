-- Create workflow_templates table for system templates
CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  trigger_type TEXT NOT NULL,
  is_system_template BOOLEAN NOT NULL DEFAULT true,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can view system templates
CREATE POLICY "Anyone can view workflow templates"
ON public.workflow_templates FOR SELECT
USING (is_system_template = true);

-- Insert default system templates

-- Template 1: Quote to Project
INSERT INTO public.workflow_templates (
  name,
  description,
  category,
  trigger_type,
  template_data
) VALUES (
  'Quote to Project Pipeline',
  'Automatically create a project and initial service order when a quote is approved. Perfect for converting sales into actionable projects.',
  'sales',
  'quote_approved',
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "position": {"x": 250, "y": 50},
        "data": {
          "label": "Quote Approved",
          "triggerType": "quote_approved"
        }
      },
      {
        "id": "create-project-1",
        "type": "action",
        "position": {"x": 250, "y": 200},
        "data": {
          "label": "Create Project",
          "actionType": "create_project",
          "config": {
            "projectName": "Project from Quote",
            "status": "planning",
            "description": "Auto-created from approved quote"
          }
        }
      },
      {
        "id": "create-service-order-1",
        "type": "action",
        "position": {"x": 250, "y": 350},
        "data": {
          "label": "Create Service Order",
          "actionType": "create_service_order",
          "config": {
            "title": "Initial Service Order",
            "status": "draft",
            "description": "Auto-created service order for project"
          }
        }
      },
      {
        "id": "create-task-1",
        "type": "action",
        "position": {"x": 250, "y": 500},
        "data": {
          "label": "Create Planning Task",
          "actionType": "create_task",
          "config": {
            "title": "Project Planning & Setup",
            "description": "Review quote details and set up project resources",
            "status": "pending",
            "priority": "high"
          }
        }
      }
    ],
    "connections": [
      {
        "id": "e1",
        "source": "trigger-1",
        "target": "create-project-1"
      },
      {
        "id": "e2",
        "source": "create-project-1",
        "target": "create-service-order-1"
      },
      {
        "id": "e3",
        "source": "create-service-order-1",
        "target": "create-task-1"
      }
    ]
  }'::jsonb
);

-- Template 2: Service Order to Invoice
INSERT INTO public.workflow_templates (
  name,
  description,
  category,
  trigger_type,
  template_data
) VALUES (
  'Service Order to Invoice',
  'Automatically generate an invoice when a service order is completed. Streamlines billing and reduces manual invoice creation.',
  'billing',
  'service_order_completed',
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "position": {"x": 250, "y": 50},
        "data": {
          "label": "Service Order Completed",
          "triggerType": "service_order_completed"
        }
      },
      {
        "id": "create-invoice-1",
        "type": "action",
        "position": {"x": 250, "y": 200},
        "data": {
          "label": "Create Invoice",
          "actionType": "create_invoice",
          "config": {
            "status": "draft",
            "description": "Auto-generated from completed service order"
          }
        }
      },
      {
        "id": "create-task-1",
        "type": "action",
        "position": {"x": 250, "y": 350},
        "data": {
          "label": "Create Review Task",
          "actionType": "create_task",
          "config": {
            "title": "Review & Send Invoice",
            "description": "Review invoice details and send to customer",
            "status": "pending",
            "priority": "high"
          }
        }
      }
    ],
    "connections": [
      {
        "id": "e1",
        "source": "trigger-1",
        "target": "create-invoice-1"
      },
      {
        "id": "e2",
        "source": "create-invoice-1",
        "target": "create-task-1"
      }
    ]
  }'::jsonb
);

-- Template 3: Project Completion Flow
INSERT INTO public.workflow_templates (
  name,
  description,
  category,
  trigger_type,
  template_data
) VALUES (
  'Project Completion Flow',
  'Comprehensive project closure workflow: create final invoice, completion tasks, and update all related documents. Ensures nothing is missed.',
  'project_management',
  'service_order_completed',
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "position": {"x": 250, "y": 50},
        "data": {
          "label": "Service Order Completed",
          "triggerType": "service_order_completed"
        }
      },
      {
        "id": "update-project-1",
        "type": "action",
        "position": {"x": 250, "y": 200},
        "data": {
          "label": "Update Project Status",
          "actionType": "update_status",
          "config": {
            "documentType": "project",
            "newStatus": "active"
          }
        }
      },
      {
        "id": "create-invoice-1",
        "type": "action",
        "position": {"x": 100, "y": 350},
        "data": {
          "label": "Create Final Invoice",
          "actionType": "create_invoice",
          "config": {
            "status": "draft",
            "description": "Final project invoice"
          }
        }
      },
      {
        "id": "create-task-1",
        "type": "action",
        "position": {"x": 400, "y": 350},
        "data": {
          "label": "Create Closeout Task",
          "actionType": "create_task",
          "config": {
            "title": "Project Closeout Review",
            "description": "Review project completion and documentation",
            "status": "pending",
            "priority": "medium"
          }
        }
      },
      {
        "id": "create-task-2",
        "type": "action",
        "position": {"x": 250, "y": 500},
        "data": {
          "label": "Create Follow-up Task",
          "actionType": "create_task",
          "config": {
            "title": "Customer Follow-up",
            "description": "Schedule follow-up call with customer",
            "status": "pending",
            "priority": "low"
          }
        }
      }
    ],
    "connections": [
      {
        "id": "e1",
        "source": "trigger-1",
        "target": "update-project-1"
      },
      {
        "id": "e2",
        "source": "update-project-1",
        "target": "create-invoice-1"
      },
      {
        "id": "e3",
        "source": "update-project-1",
        "target": "create-task-1"
      },
      {
        "id": "e4",
        "source": "create-task-1",
        "target": "create-task-2"
      }
    ]
  }'::jsonb
);

-- Template 4: New Project Setup
INSERT INTO public.workflow_templates (
  name,
  description,
  category,
  trigger_type,
  template_data
) VALUES (
  'New Project Setup',
  'Automatically set up a new project with initial tasks and planning steps when a project is created. Ensures consistent project kickoff.',
  'project_management',
  'project_created',
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "position": {"x": 250, "y": 50},
        "data": {
          "label": "Project Created",
          "triggerType": "project_created"
        }
      },
      {
        "id": "create-task-1",
        "type": "action",
        "position": {"x": 100, "y": 200},
        "data": {
          "label": "Create Planning Task",
          "actionType": "create_task",
          "config": {
            "title": "Initial Project Planning",
            "description": "Define scope, timeline, and resources",
            "status": "pending",
            "priority": "high"
          }
        }
      },
      {
        "id": "create-task-2",
        "type": "action",
        "position": {"x": 250, "y": 200},
        "data": {
          "label": "Create Resource Task",
          "actionType": "create_task",
          "config": {
            "title": "Resource Allocation",
            "description": "Assign team members and equipment",
            "status": "pending",
            "priority": "high"
          }
        }
      },
      {
        "id": "create-task-3",
        "type": "action",
        "position": {"x": 400, "y": 200},
        "data": {
          "label": "Create Kickoff Task",
          "actionType": "create_task",
          "config": {
            "title": "Schedule Kickoff Meeting",
            "description": "Arrange project kickoff with stakeholders",
            "status": "pending",
            "priority": "medium"
          }
        }
      },
      {
        "id": "create-service-order-1",
        "type": "action",
        "position": {"x": 250, "y": 350},
        "data": {
          "label": "Create Initial Service Order",
          "actionType": "create_service_order",
          "config": {
            "title": "Project Setup Service Order",
            "status": "draft",
            "description": "Initial service order for project execution"
          }
        }
      }
    ],
    "connections": [
      {
        "id": "e1",
        "source": "trigger-1",
        "target": "create-task-1"
      },
      {
        "id": "e2",
        "source": "trigger-1",
        "target": "create-task-2"
      },
      {
        "id": "e3",
        "source": "trigger-1",
        "target": "create-task-3"
      },
      {
        "id": "e4",
        "source": "create-task-2",
        "target": "create-service-order-1"
      }
    ]
  }'::jsonb
);

-- Template 5: Invoice Sent Follow-up
INSERT INTO public.workflow_templates (
  name,
  description,
  category,
  trigger_type,
  template_data
) VALUES (
  'Invoice Sent Follow-up',
  'Create follow-up tasks when an invoice is sent to track payment and customer communication. Never miss payment follow-ups.',
  'billing',
  'invoice_sent',
  '{
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "position": {"x": 250, "y": 50},
        "data": {
          "label": "Invoice Sent",
          "triggerType": "invoice_sent"
        }
      },
      {
        "id": "delay-1",
        "type": "action",
        "position": {"x": 250, "y": 200},
        "data": {
          "label": "Wait 7 Days",
          "actionType": "delay",
          "config": {
            "delayMinutes": 10080
          }
        }
      },
      {
        "id": "create-task-1",
        "type": "action",
        "position": {"x": 250, "y": 350},
        "data": {
          "label": "Create Payment Check Task",
          "actionType": "create_task",
          "config": {
            "title": "Check Invoice Payment Status",
            "description": "Verify if invoice has been paid",
            "status": "pending",
            "priority": "medium"
          }
        }
      }
    ],
    "connections": [
      {
        "id": "e1",
        "source": "trigger-1",
        "target": "delay-1"
      },
      {
        "id": "e2",
        "source": "delay-1",
        "target": "create-task-1"
      }
    ]
  }'::jsonb
);

-- Create index for performance
CREATE INDEX idx_workflow_templates_trigger_type ON public.workflow_templates(trigger_type);
CREATE INDEX idx_workflow_templates_category ON public.workflow_templates(category);

-- Create updated_at trigger
CREATE TRIGGER update_workflow_templates_updated_at
BEFORE UPDATE ON public.workflow_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();