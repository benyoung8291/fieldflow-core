export const TUTORIAL_CONTENT = {
  projects: {
    title: "Projects Module",
    description: "Learn how to manage construction and service projects",
    steps: [
      {
        title: "Welcome to Projects",
        description: "The Projects module helps you manage large-scale construction and installation projects from start to finish. Track progress, costs, and team members all in one place.",
        tips: [
          "Projects are ideal for multi-phase work requiring detailed planning",
          "Use project templates to standardize your workflows",
          "Link quotes, invoices, and service orders to projects"
        ]
      },
      {
        title: "Creating a Project",
        description: "Start by creating a new project with a clear name, customer, and timeline. Set the project status, priority, and assign team members to get started.",
        tips: [
          "Add a detailed description to help team members understand scope",
          "Set realistic start and end dates",
          "Choose the right project manager to oversee execution"
        ]
      },
      {
        title: "Managing Project Phases",
        description: "Break your project into manageable phases. Each phase can have its own timeline, budget, and team. Track completion percentage for each phase to monitor overall progress.",
        tips: [
          "Create phases for planning, execution, and closeout",
          "Set dependencies between phases when needed",
          "Update phase status regularly to keep everyone informed"
        ]
      },
      {
        title: "Budget & Cost Tracking",
        description: "Monitor project financials by tracking budgeted amounts against actual costs. Link purchase orders and expenses to see real-time cost updates.",
        tips: [
          "Set a realistic initial budget with contingency",
          "Review cost reports weekly to catch overruns early",
          "Use change orders to formally track scope changes"
        ]
      },
      {
        title: "Project Reports & Analytics",
        description: "Generate comprehensive reports showing project status, financial performance, and team productivity. Export data for stakeholder presentations.",
        tips: [
          "Schedule regular status reports to stakeholders",
          "Use visual dashboards to communicate progress",
          "Archive completed projects for future reference"
        ]
      }
    ]
  },
  service_orders: {
    title: "Service Orders Module",
    description: "Learn how to create and manage service work orders",
    steps: [
      {
        title: "Welcome to Service Orders",
        description: "Service Orders help you manage one-time and recurring service work. Track technician assignments, materials used, and customer satisfaction.",
        tips: [
          "Service orders are perfect for maintenance and repair work",
          "Link to service contracts for recurring services",
          "Track time and materials for accurate billing"
        ]
      },
      {
        title: "Creating Service Orders",
        description: "Create a service order by selecting a customer, location, and service type. Assign technicians and set priority levels to ensure timely service delivery.",
        tips: [
          "Include detailed work descriptions for technicians",
          "Set realistic completion dates",
          "Use priority levels to manage urgent requests"
        ]
      },
      {
        title: "Scheduling & Dispatching",
        description: "Schedule service appointments and dispatch technicians efficiently. View team calendars to optimize routing and minimize travel time.",
        tips: [
          "Group appointments by geographic area",
          "Allow buffer time between appointments",
          "Notify customers of scheduled arrival times"
        ]
      },
      {
        title: "Field Reporting",
        description: "Technicians can complete field reports on mobile devices, capturing photos, notes, and customer signatures. Reports sync automatically when online.",
        tips: [
          "Capture before/after photos for documentation",
          "Get customer signatures to confirm completion",
          "Note any follow-up work needed"
        ]
      },
      {
        title: "Billing & Invoicing",
        description: "Convert completed service orders to invoices automatically. Track billable hours, materials, and any additional charges approved by customers.",
        tips: [
          "Review time logs before invoicing",
          "Include detailed line items for transparency",
          "Send invoices promptly after service completion"
        ]
      }
    ]
  },
  appointments: {
    title: "Appointments Module",
    description: "Master the scheduling and calendar features",
    steps: [
      {
        title: "Welcome to Appointments",
        description: "The Appointments module provides powerful scheduling tools to manage your team's calendar. Create one-time or recurring appointments with GPS tracking.",
        tips: [
          "Color-code appointments by type or team",
          "Set reminders to reduce no-shows",
          "Use recurring appointments for maintenance schedules"
        ]
      },
      {
        title: "Creating Appointments",
        description: "Schedule appointments by selecting date, time, location, and assigned workers. Add customer details and notes about the scheduled work.",
        tips: [
          "Include travel time when scheduling",
          "Add location addresses for GPS navigation",
          "Set realistic duration estimates"
        ]
      },
      {
        title: "Calendar Views",
        description: "Switch between day, week, month, and agenda views to see appointments in different formats. Filter by team member or appointment type.",
        tips: [
          "Use week view for detailed scheduling",
          "Month view helps with long-term planning",
          "Agenda view lists all upcoming appointments"
        ]
      },
      {
        title: "GPS Check-In/Out",
        description: "Enable GPS tracking to verify worker arrivals and departures. Set radius requirements to ensure accurate location verification.",
        tips: [
          "Require GPS check-in for field appointments",
          "Set appropriate radius (50-100 meters typical)",
          "Review check-in times for payroll accuracy"
        ]
      },
      {
        title: "Appointment Templates",
        description: "Create templates for common appointment types to speed up scheduling. Templates can include default durations, locations, and checklists.",
        tips: [
          "Build templates for routine services",
          "Include standard notes and instructions",
          "Update templates based on team feedback"
        ]
      }
    ]
  },
  customers: {
    title: "Customers Module",
    description: "Learn to manage customer relationships effectively",
    steps: [
      {
        title: "Welcome to Customer Management",
        description: "Build strong customer relationships by tracking all interactions, contacts, and service history in one place. Manage customer locations and preferences.",
        tips: [
          "Keep customer information current",
          "Track communication history",
          "Note customer preferences and special requirements"
        ]
      },
      {
        title: "Creating Customer Records",
        description: "Add new customers with complete contact information, billing details, and payment terms. Categorize customers by type for better organization.",
        tips: [
          "Verify ABN/ACN for business customers",
          "Set default payment terms",
          "Tag customers for easy filtering"
        ]
      },
      {
        title: "Managing Locations",
        description: "Add multiple service locations for each customer. Store site-specific notes, access instructions, and key contacts for each location.",
        tips: [
          "Add GPS coordinates for accurate routing",
          "Note site access requirements",
          "Store emergency contact information"
        ]
      },
      {
        title: "Customer Portal",
        description: "Customers can access their own portal to view service history, upcoming appointments, and invoices. They can also request service online.",
        tips: [
          "Enable portal access for key customers",
          "Customize portal branding",
          "Monitor portal usage metrics"
        ]
      },
      {
        title: "Customer Analytics",
        description: "Review customer lifetime value, service frequency, and satisfaction scores. Identify top customers and opportunities for growth.",
        tips: [
          "Track customer profitability",
          "Monitor service request patterns",
          "Identify at-risk customers early"
        ]
      }
    ]
  },
  helpdesk: {
    title: "Help Desk Module",
    description: "Master ticket management and customer support",
    steps: [
      {
        title: "Welcome to Help Desk",
        description: "The Help Desk module centralizes customer inquiries, support tickets, and internal requests. Integrate email to automatically create tickets from customer messages.",
        tips: [
          "Set up email integration for automatic ticket creation",
          "Define ticket priority levels",
          "Create custom pipelines for different support types"
        ]
      },
      {
        title: "Managing Tickets",
        description: "View, assign, and respond to tickets from a unified inbox. Track ticket status, priority, and resolution time to maintain excellent service levels.",
        tips: [
          "Respond to high-priority tickets first",
          "Use templates for common responses",
          "Link tickets to customers and related records"
        ]
      },
      {
        title: "Email Integration",
        description: "Connect your support email accounts to automatically convert incoming emails into tickets. Responses sent from the helpdesk are synced back to email.",
        tips: [
          "Set up separate email addresses for different pipelines",
          "Configure auto-replies for new tickets",
          "Use email templates for consistency"
        ]
      },
      {
        title: "Ticket Workflows",
        description: "Create custom pipelines and statuses to match your support workflow. Set up automatic routing rules based on keywords or customer type.",
        tips: [
          "Design workflows that match your process",
          "Use automation to route tickets efficiently",
          "Track SLA compliance for each pipeline"
        ]
      },
      {
        title: "Knowledge Base",
        description: "Build a knowledge base of common issues and solutions. Reduce ticket volume by helping customers find answers themselves.",
        tips: [
          "Document frequently asked questions",
          "Include screenshots and videos",
          "Keep articles updated with latest information"
        ]
      }
    ]
  },
  invoicing: {
    title: "Invoicing Module",
    description: "Learn to create and manage invoices efficiently",
    steps: [
      {
        title: "Welcome to Invoicing",
        description: "Create professional invoices, track payments, and manage accounts receivable. Integrate with accounting systems for seamless bookkeeping.",
        tips: [
          "Set up invoice templates with your branding",
          "Configure payment terms and late fees",
          "Enable online payment options for faster collection"
        ]
      },
      {
        title: "Creating Invoices",
        description: "Generate invoices from quotes, service orders, or projects. Add line items, apply discounts, and calculate taxes automatically.",
        tips: [
          "Review all line items before sending",
          "Include clear payment instructions",
          "Attach relevant documentation or photos"
        ]
      },
      {
        title: "Payment Tracking",
        description: "Record payments, partial payments, and apply credits. Track outstanding balances and send automated payment reminders.",
        tips: [
          "Match payments to invoices promptly",
          "Send reminders before due dates",
          "Follow up on overdue accounts weekly"
        ]
      },
      {
        title: "Recurring Invoices",
        description: "Set up recurring invoices for maintenance contracts or subscription services. Invoices are generated and sent automatically on schedule.",
        tips: [
          "Review recurring invoices before auto-send",
          "Update pricing annually",
          "Notify customers of upcoming renewals"
        ]
      },
      {
        title: "Financial Reports",
        description: "Generate aging reports, revenue summaries, and payment analytics. Export to accounting software for reconciliation.",
        tips: [
          "Review aging reports weekly",
          "Monitor days to payment trends",
          "Reconcile with bank statements monthly"
        ]
      }
    ]
  },
  expenses: {
    title: "Expenses Module",
    description: "Track and approve expenses efficiently",
    steps: [
      {
        title: "Welcome to Expense Management",
        description: "Track employee expenses, receipts, and reimbursements. Set spending policies and approval workflows to maintain budget control.",
        tips: [
          "Define expense categories clearly",
          "Set approval thresholds by amount",
          "Require receipts for all expenses"
        ]
      },
      {
        title: "Submitting Expenses",
        description: "Team members can submit expenses with photo receipts from mobile devices. Categorize expenses and link to projects or service orders.",
        tips: [
          "Capture receipts immediately to avoid loss",
          "Include detailed descriptions",
          "Submit expenses promptly for faster reimbursement"
        ]
      },
      {
        title: "Approval Workflows",
        description: "Route expenses through approval chains based on amount or category. Managers receive notifications for pending approvals.",
        tips: [
          "Review expenses within 48 hours",
          "Check against policy before approving",
          "Request clarification when needed"
        ]
      },
      {
        title: "Credit Card Integration",
        description: "Connect company credit cards to automatically import transactions. Match transactions to expense reports for reconciliation.",
        tips: [
          "Reconcile card statements weekly",
          "Flag unmatched transactions",
          "Export to accounting monthly"
        ]
      },
      {
        title: "Expense Reports",
        description: "Generate reports by employee, project, or category. Track spending trends and identify cost-saving opportunities.",
        tips: [
          "Review reports at month-end",
          "Compare against budgets",
          "Identify unusual spending patterns"
        ]
      }
    ]
  },
  purchase_orders: {
    title: "Purchase Orders Module",
    description: "Master procurement and vendor management",
    steps: [
      {
        title: "Welcome to Purchase Orders",
        description: "Create purchase orders, track deliveries, and manage vendor relationships. Control spending with approval workflows and budget tracking.",
        tips: [
          "Require POs for all vendor purchases",
          "Set approval limits by amount",
          "Track delivery status actively"
        ]
      },
      {
        title: "Creating Purchase Orders",
        description: "Generate POs for materials, equipment, and services. Add line items, set delivery dates, and specify shipping addresses.",
        tips: [
          "Get quotes from multiple vendors",
          "Include detailed specifications",
          "Confirm delivery dates with vendor"
        ]
      },
      {
        title: "Approval Workflows",
        description: "Route purchase orders through appropriate approval chains. Track approval status and receive notifications when action is required.",
        tips: [
          "Approve or reject within 24 hours",
          "Check budget availability first",
          "Question unusual or expensive items"
        ]
      },
      {
        title: "Receiving & Three-Way Matching",
        description: "Record receipts when items arrive. System performs three-way matching between PO, receipt, and invoice to catch discrepancies.",
        tips: [
          "Inspect deliveries against PO",
          "Record receipt quantities accurately",
          "Report damages or shortages immediately"
        ]
      },
      {
        title: "Vendor Management",
        description: "Maintain vendor records with contact information, payment terms, and performance history. Rate vendors to inform future purchasing decisions.",
        tips: [
          "Track on-time delivery rates",
          "Monitor pricing changes",
          "Maintain backup vendors for critical items"
        ]
      }
    ]
  },
  knowledgeBase: {
    title: "Knowledge Base Module",
    description: "Learn how to create, share, and discover knowledge articles",
    steps: [
      {
        title: "Welcome to Knowledge Base",
        description: "The Knowledge Base is your team's central hub for documenting processes, sharing best practices, and finding answers quickly. Built with a Notion-inspired design for intuitive organization.",
        tips: [
          "Create articles for frequently asked questions",
          "Document standard operating procedures",
          "Share troubleshooting guides and solutions"
        ]
      },
      {
        title: "Creating Articles",
        description: "Write comprehensive articles using the rich text editor. Add summaries, choose categories, and tag articles to make them discoverable. Include document examples and attachments for reference.",
        tips: [
          "Write clear, concise titles for easy scanning",
          "Add a summary to help users quickly understand content",
          "Use the rich editor for formatting and structure",
          "Attach relevant files like templates or examples"
        ]
      },
      {
        title: "Organizing with Categories & Tags",
        description: "Structure your knowledge base with categories and tags. Categories provide high-level organization while tags help with cross-referencing related articles.",
        tips: [
          "Create categories by topic area or department",
          "Use consistent tagging conventions",
          "Tag articles with multiple keywords for discoverability",
          "Feature important articles to highlight them"
        ]
      },
      {
        title: "Search & Discovery",
        description: "Find information quickly using the powerful search that looks through titles, content, and tags. Browse by category or featured articles for curated content.",
        tips: [
          "Search uses keywords from title, content, and tags",
          "Filter by category to narrow results",
          "Check featured articles for critical information",
          "View counts show popular articles"
        ]
      },
      {
        title: "Collaboration & Feedback",
        description: "Rate articles as helpful or not helpful to improve quality. Submit suggestions for edits or new content. Attach example documents to enrich articles.",
        tips: [
          "Provide feedback to help improve articles",
          "Suggest improvements when you spot gaps",
          "Upload examples like templates or forms",
          "Version history tracks all changes automatically"
        ]
      }
    ]
  }
};
