import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { BrandColorsProvider } from "@/components/BrandColorsProvider";
import Auth from "./pages/Auth";
import { useUserAccess } from "./hooks/useUserAccess";
import { usePWAUpdate } from "./hooks/usePWAUpdate";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { useOfflineSyncOffice } from "./hooks/useOfflineSyncOffice";
import { useRealtimeNotifications } from "./hooks/useNotifications";
import { MobileBottomNav } from "./components/layout/MobileBottomNav";
import { WorkerMobileBottomNav } from "./components/layout/WorkerMobileBottomNav";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Loader2 } from "lucide-react";

// Lazy load all pages for code splitting and faster initial load
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const Quotes = lazy(() => import("./pages/Quotes"));
const QuoteDetails = lazy(() => import("./pages/QuoteDetails"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"));
const ServiceOrders = lazy(() => import("./pages/ServiceOrders"));
const ServiceOrderDetails = lazy(() => import("./pages/ServiceOrderDetails"));
const ServiceContracts = lazy(() => import("./pages/ServiceContracts"));
const ServiceContractDetails = lazy(() => import("./pages/ServiceContractDetails"));
const Timesheets = lazy(() => import("./pages/Timesheets"));
const TimesheetDetails = lazy(() => import("./pages/TimesheetDetails"));
const Scheduler = lazy(() => import("./pages/Scheduler"));
const Appointments = lazy(() => import("./pages/Appointments"));
const AppointmentDetails = lazy(() => import("./pages/AppointmentDetails"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetails = lazy(() => import("./pages/CustomerDetails"));
const CustomerLocationDetails = lazy(() => import("./pages/CustomerLocationDetails"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadDetails = lazy(() => import("./pages/LeadDetails"));
const Workers = lazy(() => import("./pages/Workers"));
const WorkerDetails = lazy(() => import("./pages/WorkerDetails"));
const Settings = lazy(() => import("./pages/Settings"));
const Analytics = lazy(() => import("./pages/Analytics"));
const QuotePipeline = lazy(() => import("./pages/QuotePipeline"));
const Tasks = lazy(() => import("./pages/Tasks"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Skills = lazy(() => import("./pages/Skills"));
const TrainingMatrix = lazy(() => import("./pages/TrainingMatrix"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoicesList = lazy(() => import("./pages/InvoicesList"));
const InvoiceDetails = lazy(() => import("./pages/InvoiceDetails"));
const RecurringInvoices = lazy(() => import("./pages/RecurringInvoices"));
const RecurringInvoiceDetails = lazy(() => import("./pages/RecurringInvoiceDetails"));
const HelpDesk = lazy(() => import("./pages/HelpDesk"));
const HelpdeskAnalytics = lazy(() => import("./pages/HelpdeskAnalytics"));
const CRMHub = lazy(() => import("./pages/CRMHub"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const PurchaseOrders = lazy(() => import("@/pages/PurchaseOrders"));
const PurchaseOrderDetails = lazy(() => import("@/pages/PurchaseOrderDetails"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const ExpenseDetails = lazy(() => import("@/pages/ExpenseDetails"));
const CreditCardReconciliation = lazy(() => import("@/pages/CreditCardReconciliation"));
const UnassignedTransactions = lazy(() => import("@/pages/UnassignedTransactions"));
const Contacts = lazy(() => import("@/pages/Contacts"));
const ContactDetails = lazy(() => import("@/pages/ContactDetails"));
const Workflows = lazy(() => import("@/pages/Workflows"));
const WorkflowBuilder = lazy(() => import("@/pages/WorkflowBuilder"));
const WorkflowTemplateSelector = lazy(() => import("@/pages/WorkflowTemplateSelector"));
const WorkflowExecutionsList = lazy(() => import("@/components/workflows/WorkflowExecutionsList"));
const FieldReports = lazy(() => import("@/pages/FieldReports"));
const APInvoicesList = lazy(() => import("./pages/APInvoicesList"));
const APInvoiceDetails = lazy(() => import("./pages/APInvoiceDetails"));
const APInvoiceApprovalQueue = lazy(() => import("./pages/APInvoiceApprovalQueue"));
const WorkerDashboard = lazy(() => import("./pages/worker/WorkerDashboard"));
const WorkerProfile = lazy(() => import("./pages/worker/WorkerProfile"));
const WorkerAppointments = lazy(() => import("./pages/worker/WorkerAppointments"));
const WorkerAppointmentDetails = lazy(() => import("./pages/worker/WorkerAppointmentDetails"));
const WorkerTimeLogs = lazy(() => import("./pages/worker/WorkerTimeLogs"));
const WorkerTasks = lazy(() => import("./pages/worker/WorkerTasks"));
const WorkerCalendar = lazy(() => import("./pages/worker/WorkerCalendar"));
const WorkerSchedule = lazy(() => import("./pages/worker/WorkerSchedule"));
const WorkerFieldReport = lazy(() => import("./pages/worker/WorkerFieldReport"));
const WorkerFieldReportStandalone = lazy(() => import("./pages/worker/WorkerFieldReportStandalone"));
const EditFieldReport = lazy(() => import("./pages/worker/EditFieldReport"));
const ViewFieldReport = lazy(() => import("./pages/worker/ViewFieldReport"));
const SupervisorDashboard = lazy(() => import("./pages/worker/supervisor/SupervisorDashboard"));
const SupervisorMapDashboard = lazy(() => import("./pages/worker/supervisor/SupervisorMapDashboard"));
const SupervisorAppointments = lazy(() => import("./pages/worker/supervisor/SupervisorAppointments"));
const SupervisorServiceOrders = lazy(() => import("./pages/worker/supervisor/SupervisorServiceOrders"));
const FinancialReconciliation = lazy(() => import("./pages/FinancialReconciliation"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));

// Loading component for lazy-loaded routes
const RouteLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { data: access, isLoading, error } = useUserAccess();
  const location = window.location.pathname;
  
  // Show loading while checking access
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // If there's an error (user not authenticated), redirect to auth
  if (error || !access) {
    return <Navigate to="/auth" replace />;
  }

  // Worker-only routes - require worker access
  if (location.startsWith("/worker")) {
    if (!access.canAccessWorker) {
      // User is authenticated but doesn't have worker access
      // Redirect to office dashboard if they have office access, otherwise to auth
      if (access.canAccessOffice) {
        return <Navigate to="/dashboard" replace />;
      }
      return <Navigate to="/auth" replace />;
    }
  } 
  // Office routes - require role
  else {
    if (!access.canAccessOffice) {
      // User is authenticated but doesn't have office access
      // Redirect to worker dashboard if they have worker access, otherwise to auth
      if (access.canAccessWorker) {
        return <Navigate to="/worker/dashboard" replace />;
      }
      return <Navigate to="/auth" replace />;
    }
  }

  return <>{children}</>;
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Initialize PWA and offline sync for both worker and office apps
  usePWAUpdate();
  useOfflineSync();
  useOfflineSyncOffice();
  useRealtimeNotifications();

  useEffect(() => {
    let mounted = true;
    
    // Check if OAuth flag is stuck
    const oauthFlag = localStorage.getItem('oauth_in_progress');
    if (oauthFlag === 'true') {
      console.warn("⚠️ Found stuck oauth_in_progress flag on mount, clearing it");
      localStorage.removeItem('oauth_in_progress');
      localStorage.removeItem('oauth_session_key');
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        console.log("📱 Initial session check:", session ? "authenticated" : "not authenticated");
        if (mounted) {
          setIsAuthenticated(!!session);
        }
      })
      .catch((error) => {
        console.error("Auth session error:", error);
        if (mounted) {
          setIsAuthenticated(false);
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const timestamp = new Date().toISOString();
      console.log(`🔐 [${timestamp}] Auth event:`, event, "Session:", !!session);
      
      // Ignore auth changes during OAuth flow
      const oauthInProgress = localStorage.getItem('oauth_in_progress');
      if (oauthInProgress === 'true') {
        console.log(`⏭️ [${timestamp}] BLOCKED - OAuth in progress`);
        return;
      }
      
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        console.log(`✅ [${timestamp}] Setting authenticated:`, !!session);
        if (mounted) {
          setIsAuthenticated(!!session);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log(`🚪 [${timestamp}] Signed out`);
        if (mounted) {
          setIsAuthenticated(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) {
    return (
      <QueryClientProvider client={queryClient}>
        <ViewModeProvider>
          <ThemeProvider>
            <div className="flex items-center justify-center min-h-screen">Loading...</div>
          </ThemeProvider>
        </ViewModeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrandColorsProvider>
        <ViewModeProvider>
          <ThemeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
              {isAuthenticated && <OnboardingWizard />}
              <MobileBottomNav />
              <WorkerMobileBottomNav />
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                  <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/worker/auth" element={<Navigate to="/auth" replace />} />
                  <Route path="/dashboard" element={isAuthenticated ? <ProtectedRoute><Dashboard /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/super-admin" element={isAuthenticated ? <ProtectedRoute><SuperAdmin /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/users" element={isAuthenticated ? <ProtectedRoute><UserManagement /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/quotes" element={isAuthenticated ? <ProtectedRoute><Quotes /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/quotes/:id" element={isAuthenticated ? <ProtectedRoute><QuoteDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/projects" element={isAuthenticated ? <ProtectedRoute><Projects /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/projects/:id" element={isAuthenticated ? <ProtectedRoute><ProjectDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/service-orders" element={isAuthenticated ? <ProtectedRoute><ServiceOrders /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/service-orders/:id" element={isAuthenticated ? <ProtectedRoute><ServiceOrderDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/service-contracts" element={isAuthenticated ? <ProtectedRoute><ServiceContracts /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/service-contracts/:id" element={isAuthenticated ? <ProtectedRoute><ServiceContractDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/timesheets" element={isAuthenticated ? <ProtectedRoute><Timesheets /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/timesheets/:id" element={isAuthenticated ? <ProtectedRoute><TimesheetDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/scheduler" element={isAuthenticated ? <ProtectedRoute><Scheduler /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/appointments" element={isAuthenticated ? <ProtectedRoute><Appointments /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/appointments/:id" element={isAuthenticated ? <ProtectedRoute><AppointmentDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customers" element={isAuthenticated ? <ProtectedRoute><Customers /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customers/:id" element={isAuthenticated ? <ProtectedRoute><CustomerDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer-locations/:id" element={isAuthenticated ? <ProtectedRoute><CustomerLocationDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/leads" element={isAuthenticated ? <ProtectedRoute><Leads /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/leads/:id" element={isAuthenticated ? <ProtectedRoute><LeadDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workers" element={isAuthenticated ? <ProtectedRoute><Workers /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workers/:id" element={isAuthenticated ? <ProtectedRoute><WorkerDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/skills" element={isAuthenticated ? <ProtectedRoute><Skills /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/training-matrix" element={isAuthenticated ? <ProtectedRoute><TrainingMatrix /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/analytics" element={isAuthenticated ? <ProtectedRoute><Analytics /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/financial-reconciliation" element={isAuthenticated ? <ProtectedRoute><FinancialReconciliation /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/pipeline" element={isAuthenticated ? <ProtectedRoute><QuotePipeline /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/settings" element={isAuthenticated ? <ProtectedRoute><Settings /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/tasks" element={isAuthenticated ? <ProtectedRoute><Tasks /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/invoices" element={isAuthenticated ? <ProtectedRoute><InvoicesList /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/invoices/create" element={isAuthenticated ? <ProtectedRoute><Invoices /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/invoices/:id" element={isAuthenticated ? <ProtectedRoute><InvoiceDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/ap-invoices" element={isAuthenticated ? <ProtectedRoute><APInvoicesList /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/ap-invoices/:id" element={isAuthenticated ? <ProtectedRoute><APInvoiceDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/ap-invoice-approval-queue" element={isAuthenticated ? <ProtectedRoute><APInvoiceApprovalQueue /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/recurring-invoices" element={isAuthenticated ? <ProtectedRoute><RecurringInvoices /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/recurring-invoices/:id" element={isAuthenticated ? <ProtectedRoute><RecurringInvoiceDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/suppliers" element={isAuthenticated ? <ProtectedRoute><Suppliers /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/purchase-orders" element={isAuthenticated ? <ProtectedRoute><PurchaseOrders /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/purchase-orders/:id" element={isAuthenticated ? <ProtectedRoute><PurchaseOrderDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/expenses" element={isAuthenticated ? <ProtectedRoute><Expenses /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/expenses/:id" element={isAuthenticated ? <ProtectedRoute><ExpenseDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/credit-card-reconciliation" element={isAuthenticated ? <ProtectedRoute><CreditCardReconciliation /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/unassigned-transactions" element={isAuthenticated ? <ProtectedRoute><UnassignedTransactions /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workflows" element={isAuthenticated ? <ProtectedRoute><Workflows /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workflows/templates" element={isAuthenticated ? <ProtectedRoute><WorkflowTemplateSelector /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workflows/:id" element={isAuthenticated ? <ProtectedRoute><WorkflowBuilder /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/field-reports" element={isAuthenticated ? <ProtectedRoute><FieldReports /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/contacts" element={isAuthenticated ? <ProtectedRoute><Contacts /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/contacts/:id" element={isAuthenticated ? <ProtectedRoute><ContactDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/helpdesk" element={isAuthenticated ? <ProtectedRoute><HelpDesk /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/helpdesk/analytics" element={isAuthenticated ? <ProtectedRoute><HelpdeskAnalytics /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/crm-hub" element={isAuthenticated ? <ProtectedRoute><CRMHub /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/knowledge-base" element={isAuthenticated ? <ProtectedRoute><KnowledgeBase /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            {/* Worker Mobile Routes */}
            <Route path="/worker/dashboard" element={isAuthenticated ? <ProtectedRoute><WorkerDashboard /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/profile" element={isAuthenticated ? <ProtectedRoute><WorkerProfile /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/supervisor/dashboard" element={isAuthenticated ? <ProtectedRoute><SupervisorDashboard /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/supervisor/map" element={isAuthenticated ? <ProtectedRoute><SupervisorMapDashboard /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/supervisor/appointments" element={isAuthenticated ? <ProtectedRoute><SupervisorAppointments /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/supervisor/service-orders" element={isAuthenticated ? <ProtectedRoute><SupervisorServiceOrders /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/appointments" element={isAuthenticated ? <ProtectedRoute><WorkerAppointments /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/appointments/:id" element={isAuthenticated ? <ProtectedRoute><WorkerAppointmentDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/time-logs" element={isAuthenticated ? <ProtectedRoute><WorkerTimeLogs /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/tasks" element={isAuthenticated ? <ProtectedRoute><WorkerTasks /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/calendar" element={isAuthenticated ? <ProtectedRoute><WorkerCalendar /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/field-report/:id" element={isAuthenticated ? <ProtectedRoute><WorkerFieldReport /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/field-report/:appointmentId/edit/:reportId" element={isAuthenticated ? <ProtectedRoute><EditFieldReport /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/field-report/:appointmentId/view/:reportId" element={isAuthenticated ? <ProtectedRoute><ViewFieldReport /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/field-report-new" element={isAuthenticated ? <ProtectedRoute><WorkerFieldReportStandalone /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/schedule" element={isAuthenticated ? <ProtectedRoute><WorkerSchedule /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
      </ViewModeProvider>
      </BrandColorsProvider>
    </QueryClientProvider>
  );
};

export default App;
