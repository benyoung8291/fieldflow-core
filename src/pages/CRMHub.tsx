import { useNavigate } from "react-router-dom";
import { Users, UserPlus, FileText, Briefcase, Phone, Plus, ClipboardList } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import LeadDialog from "@/components/leads/LeadDialog";
import ContactDialog from "@/components/customers/ContactDialog";
import QuoteDialog from "@/components/quotes/QuoteDialog";
import TaskDialog from "@/components/tasks/TaskDialog";

export default function CRMHub() {
  const navigate = useNavigate();
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  const crmPages = [
    {
      title: "Leads",
      description: "Manage potential customers and sales opportunities",
      path: "/leads",
      icon: UserPlus,
      color: "text-primary",
    },
    {
      title: "Contacts",
      description: "Manage contacts throughout their entire lifecycle",
      path: "/contacts",
      icon: Users,
      color: "text-secondary",
    },
    {
      title: "Customers",
      description: "View and manage your customer base",
      path: "/customers",
      icon: Users,
      color: "text-accent",
    },
    {
      title: "Quotes",
      description: "Create and track quotes for potential work",
      path: "/quotes",
      icon: FileText,
      color: "text-info",
    },
    {
      title: "Projects",
      description: "Monitor project progress and timelines",
      path: "/projects",
      icon: Briefcase,
      color: "text-success",
    },
  ];

  const quickActions = [
    {
      title: "Create Lead",
      icon: UserPlus,
      action: () => setIsLeadDialogOpen(true),
      color: "bg-primary text-primary-foreground",
    },
    {
      title: "Create Contact",
      icon: Phone,
      action: () => setIsContactDialogOpen(true),
      color: "bg-secondary text-secondary-foreground",
    },
    {
      title: "Create Quote",
      icon: FileText,
      action: () => setIsQuoteDialogOpen(true),
      color: "bg-accent text-accent-foreground",
    },
    {
      title: "Create Task",
      icon: ClipboardList,
      action: () => setIsTaskDialogOpen(true),
      color: "bg-info text-info-foreground",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-3 lg:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight">CRM Hub</h1>
          <p className="text-muted-foreground text-sm lg:text-base mt-1">
            Manage your customer relationships and sales pipeline
          </p>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Create new records quickly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.title}
                    onClick={action.action}
                    className={`h-24 flex flex-col items-center justify-center gap-2 ${action.color}`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{action.title}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* CRM Sections */}
        <Card>
          <CardHeader>
            <CardTitle>CRM Sections</CardTitle>
            <CardDescription>
              Navigate to different CRM areas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {crmPages.map((page) => {
                const Icon = page.icon;
                return (
                  <Button
                    key={page.path}
                    variant="outline"
                    onClick={() => navigate(page.path)}
                    className="h-20 flex items-center justify-start gap-4 px-4"
                  >
                    <div className={`p-3 rounded-lg bg-muted ${page.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col items-start text-left">
                      <span className="font-semibold">{page.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {page.description}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <LeadDialog
        open={isLeadDialogOpen}
        onOpenChange={setIsLeadDialogOpen}
      />
      <ContactDialog
        open={isContactDialogOpen}
        onOpenChange={setIsContactDialogOpen}
        customerId=""
      />
      <QuoteDialog
        open={isQuoteDialogOpen}
        onOpenChange={setIsQuoteDialogOpen}
      />
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onSubmit={() => {
          setIsTaskDialogOpen(false);
        }}
      />
    </DashboardLayout>
  );
}
