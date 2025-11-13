# Workflow Templates

## Overview

Workflow templates are pre-built automation workflows that users can instantly activate and customize. They provide best-practice workflows for common business scenarios, eliminating the need to build workflows from scratch.

## Available Templates

### 1. Quote to Project Pipeline
**Category:** Sales  
**Trigger:** Quote Approved

**What it does:**
- Automatically creates a project when a quote is approved
- Creates an initial service order linked to the project
- Generates a planning task for project setup

**Use case:** Perfect for converting sales opportunities into actionable projects without manual data entry.

**Actions:**
1. Create Project (status: planning)
2. Create Service Order (status: draft, linked to project)
3. Create Task: "Project Planning & Setup" (priority: high)

---

### 2. Service Order to Invoice
**Category:** Billing  
**Trigger:** Service Order Completed

**What it does:**
- Generates an invoice automatically when work is finished
- Creates a review task to ensure invoice accuracy before sending

**Use case:** Streamlines billing by eliminating manual invoice creation for completed work.

**Actions:**
1. Create Invoice (status: draft, linked to service order)
2. Create Task: "Review & Send Invoice" (priority: high)

---

### 3. Project Completion Flow
**Category:** Project Management  
**Trigger:** Service Order Completed

**What it does:**
- Updates project status when service orders complete
- Creates final invoice for project billing
- Generates closeout and follow-up tasks

**Use case:** Ensures comprehensive project closure with proper documentation and customer follow-up.

**Actions:**
1. Update Project Status (to: active)
2. Create Final Invoice (linked to project)
3. Create Task: "Project Closeout Review" (priority: medium)
4. Create Task: "Customer Follow-up" (priority: low)

---

### 4. New Project Setup
**Category:** Project Management  
**Trigger:** Project Created

**What it does:**
- Automatically sets up initial project tasks
- Creates service order for project execution
- Ensures consistent project kickoff process

**Use case:** Standardizes project initialization with all necessary planning tasks.

**Actions:**
1. Create Task: "Initial Project Planning" (priority: high)
2. Create Task: "Resource Allocation" (priority: high)
3. Create Task: "Schedule Kickoff Meeting" (priority: medium)
4. Create Service Order: "Project Setup" (status: draft)

---

### 5. Invoice Sent Follow-up
**Category:** Billing  
**Trigger:** Invoice Sent

**What it does:**
- Waits 7 days after invoice is sent
- Creates a task to check payment status
- Ensures timely follow-up on outstanding invoices

**Use case:** Never miss payment follow-ups with automated reminders.

**Actions:**
1. Delay (7 days / 10,080 minutes)
2. Create Task: "Check Invoice Payment Status" (priority: medium)

---

## Using Templates

### Method 1: From Workflows List
1. Navigate to `/workflows`
2. Click "Use Template" button
3. Browse templates by category
4. Click "Use Template" on desired workflow
5. Workflow is created and ready to customize
6. Activate when ready

### Method 2: From New Workflow
1. Click "New Workflow"
2. Choose "Start from a Template"
3. Select template from gallery
4. Customize as needed

### Method 3: Direct Template Gallery
1. Navigate to `/workflows/templates`
2. Browse all available templates
3. Filter by category
4. Select and create

## Customizing Templates

After creating from a template:

1. **Edit Name & Description**: Click workflow name to rename
2. **Modify Trigger**: Change trigger type in dropdown
3. **Add/Remove Nodes**: Use action sidebar to add nodes, delete unwanted ones
4. **Reconfigure Actions**: Click nodes to edit their settings
5. **Adjust Layout**: Drag nodes to reorganize visual layout
6. **Add Conditions**: Insert condition nodes for branching logic
7. **Test**: Use "Test Run" to verify behavior
8. **Activate**: Toggle workflow to active when ready

## Template Configuration

### Node Configuration Examples

**Create Project Node:**
```json
{
  "projectName": "Project from Quote",
  "status": "planning",
  "description": "Auto-created from approved quote"
}
```

**Create Invoice Node:**
```json
{
  "status": "draft",
  "description": "Auto-generated from completed service order"
}
```

**Create Task Node:**
```json
{
  "title": "Project Planning & Setup",
  "description": "Review quote details and set up project resources",
  "status": "pending",
  "priority": "high"
}
```

**Delay Node:**
```json
{
  "delayMinutes": 10080
}
```

## Creating Custom Templates

To add new system templates:

1. Design workflow in builder
2. Test thoroughly with real data
3. Export node and connection data
4. Add to migration SQL:

```sql
INSERT INTO public.workflow_templates (
  name,
  description,
  category,
  trigger_type,
  template_data
) VALUES (
  'Your Template Name',
  'Description of what it does',
  'category_name',
  'trigger_type',
  '{
    "nodes": [...],
    "connections": [...]
  }'::jsonb
);
```

## Best Practices

1. **Always Test First**: Create from template and test with sample data before activating
2. **Customize for Your Needs**: Templates are starting points - adjust to your workflow
3. **Start Simple**: Use basic templates first, add complexity as you learn
4. **Document Changes**: Add notes in description about customizations
5. **Monitor Executions**: Check execution logs regularly after activation
6. **Version Control**: Save copies before major template changes

## Template Categories

- **Sales**: Quote and lead management workflows
- **Billing**: Invoice and payment workflows  
- **Project Management**: Project lifecycle workflows
- **General**: Cross-functional and utility workflows

## Future Templates

Planned templates for future releases:
- Lead Nurturing Workflow
- Contract Renewal Reminders
- Overdue Invoice Escalation
- Project Milestone Notifications
- Service Order Scheduling Automation
- Customer Onboarding Workflow
- Recurring Service Automation
- Quality Check Process

## Support

For questions about templates or to suggest new templates:
- Review template documentation
- Check execution logs for issues
- Test with sample data first
- Start from simpler templates when learning
