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
import { DataAccessLoggerProvider } from "@/contexts/DataAccessLoggerContext";
import Auth from "./pages/Auth";
import FirstPasswordReset from "./pages/FirstPasswordReset";
import { useUserAccess } from "./hooks/useUserAccess";
import { usePWAUpdate } from "./hooks/usePWAUpdate";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { useOfflineSyncOffice } from "./hooks/useOfflineSyncOffice";
import { useRealtimeNotifications } from "./hooks/useNotifications";
import { MobileBottomNav } from "./components/layout/MobileBottomNav";
import { WorkerMobileBottomNav } from "./components/layout/WorkerMobileBottomNav";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { GlobalChatNotifications } from "@/components/chat/GlobalChatNotifications";
import { UpdateNotificationBar } from "@/components/UpdateNotificationBar";
import { Loader2 } from "lucide-react";
import { PermissionProtectedRoute } from "@/components/PermissionProtectedRoute";
import { SupervisorProtectedRoute } from "@/components/SupervisorProtectedRoute";
import { getRouteModule } from "@/config/routePermissions";
import { APP_VERSION } from "@/lib/version";

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
const TimeLogs = lazy(() => import("./pages/TimeLogs"));
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
const SupplierDetails = lazy(() => import("@/pages/SupplierDetails"));
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
const WorkerRequestDetails = lazy(() => import("./pages/worker/WorkerRequestDetails"));
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
const CustomerDashboard = lazy(() => import("./pages/customer/CustomerDashboard"));
const CustomerLocations = lazy(() => import("./pages/customer/CustomerLocations"));
const CustomerRequests = lazy(() => import("./pages/customer/CustomerRequests"));
const RequestView = lazy(() => import("./pages/customer/RequestView"));
const LocationFloorPlans = lazy(() => import("./pages/customer/LocationFloorPlans"));
const CustomerServiceOrders = lazy(() => import("./pages/customer/CustomerServiceOrders"));
const CustomerFieldReports = lazy(() => import("./pages/customer/CustomerFieldReports"));
const ServiceOrderView = lazy(() => import("./pages/customer/ServiceOrderView"));
const AppointmentView = lazy(() => import("./pages/customer/AppointmentView"));
const FieldReportView = lazy(() => import("./pages/customer/FieldReportView"));
const TemplateBuilderPage = lazy(() => import("./pages/TemplateBuilderPage"));
const TemplatesListPage = lazy(() => import("./pages/TemplatesListPage"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));
const SharedFloorPlanMarkup = lazy(() => import("./pages/public/SharedFloorPlanMarkup"));
const Chat = lazy(() => import("./pages/Chat"));
const WorkerChat = lazy(() => import("./pages/worker/WorkerChat"));
const TVAvailabilityDashboard = lazy(() => import("./pages/tv/TVAvailabilityDashboard"));
const TVPinGate = lazy(() => import("./components/tv/TVPinGate").then(m => ({ default: m.TVPinGate })));
const ImportHub = lazy(() => import("./pages/settings/ImportHub"));
const ImportLocations = lazy(() => import("./pages/settings/ImportLocations"));
const ImportWorkers = lazy(() => import("./pages/settings/ImportWorkers"));
const ImportFieldReports = lazy(() => import("./pages/settings/ImportFieldReports"));

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

  // CRITICAL SECURITY: Customer portal users can ONLY access /customer routes
  // Check for exact /customer path match (not /customers or other paths)
  const isCustomerPortalRoute = location === "/customer" || location.startsWith("/customer/");
  
  // CRITICAL: If user is marked as customer, they can ONLY access customer portal
  // This blocks even if they somehow have other access flags set
  if (access.isCustomer) {
    if (!isCustomerPortalRoute) {
      return <Navigate to="/customer" replace />;
    }
    return <>{children}</>;
  }

  // Customer portal routes - require customer access
  if (isCustomerPortalRoute) {
    if (!access.canAccessCustomerPortal) {
      // User is authenticated but doesn't have customer portal access
      if (access.canAccessOffice) {
        return <Navigate to="/dashboard" replace />;
      }
      if (access.canAccessWorker) {
        return <Navigate to="/worker/dashboard" replace />;
      }
      return <Navigate to="/auth" replace />;
    }
    return <>{children}</>;
  }

  // Worker-only routes - require worker access
  if (location.startsWith("/worker")) {
    if (!access.canAccessWorker) {
      // User is authenticated but doesn't have worker access
      // Redirect to office dashboard if they have office access, otherwise to auth
      if (access.canAccessOffice) {
        return <Navigate to="/dashboard" replace />;
      }
      if (access.canAccessCustomerPortal) {
        return <Navigate to="/customer" replace />;
      }
      return <Navigate to="/auth" replace />;
    }
  } 
  // Office routes - require office role
  else {
    if (!access.canAccessOffice) {
      // User is authenticated but doesn't have office access
      if (access.canAccessWorker) {
        return <Navigate to="/worker/dashboard" replace />;
      }
      if (access.canAccessCustomerPortal) {
        return <Navigate to="/customer" replace />;
      }
      return <Navigate to="/auth" replace />;
    }
  }

  return <>{children}</>;
};

// Component to redirect authenticated users to their default route
const RedirectToDefaultRoute = () => {
  const { data: access, isLoading, error } = useUserAccess();
  
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  // SECURITY: If no access data or error, redirect to auth - never default to office
  if (error || !access || !access.defaultRoute) {
    return <Navigate to="/auth" replace />;
  }
  
  return <Navigate to={access.defaultRoute} replace />;
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Initialize PWA and offline sync for both worker and office apps
  usePWAUpdate();
  useOfflineSync();
  useOfflineSyncOffice();
  useRealtimeNotifications();

  // Version-based force update detection
  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version');
    const currentVersion = APP_VERSION;
    
    if (storedVersion && storedVersion !== currentVersion) {
      console.log(`Version changed: ${storedVersion} → ${currentVersion}`);
      // Clear all caches and reload
      Promise.all([
        'caches' in window
          ? caches.keys().then(names => Promise.all(names.map(name => caches.delete(name))))
          : Promise.resolve()
      ]).then(() => {
        window.location.reload();
      });
    }
    
    localStorage.setItem('app_version', currentVersion);
  }, []);

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
      
      // SECURITY: Clear user access cache on any auth change to prevent stale permissions
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        queryClient.removeQueries({ queryKey: ["user-access"] });
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
        <DataAccessLoggerProvider>
          <ViewModeProvider>
            <ThemeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
              <UpdateNotificationBar />
              {isAuthenticated && <GlobalChatNotifications />}
              {isAuthenticated && <OnboardingWizard />}
              <MobileBottomNav />
              <WorkerMobileBottomNav />
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/share/floor-plan/:token" element={<SharedFloorPlanMarkup />} />
                  <Route path="/tv/availability" element={<TVPinGate><TVAvailabilityDashboard /></TVPinGate>} />
                  
                  <Route path="/" element={isAuthenticated ? <RedirectToDefaultRoute /> : <Navigate to="/auth" replace />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/first-password-reset" element={isAuthenticated ? <FirstPasswordReset /> : <Navigate to="/auth" replace />} />
                  <Route path="/worker/auth" element={<Navigate to="/auth" replace />} />
                  <Route path="/dashboard" element={isAuthenticated ? <ProtectedRoute><Dashboard /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/super-admin" element={isAuthenticated ? <ProtectedRoute><SuperAdmin /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/users" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/users")}><UserManagement /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/quotes" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/quotes")}><Quotes /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/quotes/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/quotes")}><QuoteDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/projects" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/projects")}><Projects /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/projects/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/projects")}><ProjectDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/service-orders" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/service-orders")}><ServiceOrders /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/service-orders/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/service-orders")}><ServiceOrderDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/service-contracts" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/service-contracts")}><ServiceContracts /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/service-contracts/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/service-contracts")}><ServiceContractDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/timesheets" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/timesheets")}><Timesheets /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/timesheets/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/timesheets")}><TimesheetDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/time-logs" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/timesheets")}><TimeLogs /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/scheduler" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/scheduler")}><Scheduler /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/appointments" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/appointments")}><Appointments /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/appointments/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/appointments")}><AppointmentDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customers" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/customers")}><Customers /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customers/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/customers")}><CustomerDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer-locations/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/customers")}><CustomerLocationDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/leads" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/leads")}><Leads /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/leads/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/leads")}><LeadDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workers" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/workers")}><Workers /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workers/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/workers")}><WorkerDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/skills" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/skills")}><Skills /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/training-matrix" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/training-matrix")}><TrainingMatrix /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/analytics" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/analytics")}><Analytics /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/financial-reconciliation" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/financial-reconciliation")}><FinancialReconciliation /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/pipeline" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/pipeline")}><QuotePipeline /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/settings" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/settings")}><Settings /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/settings/templates" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/settings")}><TemplatesListPage /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/settings/import" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/settings")}><ImportHub /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/settings/import/locations" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/settings")}><ImportLocations /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/settings/import/workers" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/settings")}><ImportWorkers /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/settings/import/field-reports" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/settings")}><ImportFieldReports /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/templates" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/settings")}><TemplatesListPage /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/template-builder/:id?" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/settings")}><TemplateBuilderPage /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/tasks" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/tasks")}><Tasks /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/invoices" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/invoices")}><InvoicesList /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/invoices/create" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/invoices")}><Invoices /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/invoices/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/invoices")}><InvoiceDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/ap-invoices" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/ap-invoices")}><APInvoicesList /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/ap-invoices/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/ap-invoices")}><APInvoiceDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/ap-invoice-approval-queue" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/ap-invoices")}><APInvoiceApprovalQueue /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/recurring-invoices" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/invoices")}><RecurringInvoices /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/recurring-invoices/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/invoices")}><RecurringInvoiceDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/suppliers" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/suppliers")}><Suppliers /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/suppliers/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/suppliers")}><SupplierDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/purchase-orders" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/purchase-orders")}><PurchaseOrders /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/purchase-orders/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/purchase-orders")}><PurchaseOrderDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/expenses" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/expenses")}><Expenses /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/expenses/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/expenses")}><ExpenseDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/credit-card-reconciliation" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/expenses")}><CreditCardReconciliation /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/unassigned-transactions" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/expenses")}><UnassignedTransactions /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workflows" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/workflows")}><Workflows /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workflows/templates" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/workflows")}><WorkflowTemplateSelector /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/workflows/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/workflows")}><WorkflowBuilder /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/field-reports" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/field-reports")}><FieldReports /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/contacts" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/contacts")}><Contacts /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/contacts/:id" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/contacts")}><ContactDetails /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/helpdesk" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/helpdesk")}><HelpDesk /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/helpdesk/analytics" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/helpdesk")}><HelpdeskAnalytics /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/crm-hub" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/crm")}><CRMHub /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/knowledge-base" element={isAuthenticated ? <ProtectedRoute><PermissionProtectedRoute module={getRouteModule("/knowledge-base")}><KnowledgeBase /></PermissionProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            {/* Customer Portal Routes */}
            <Route path="/customer" element={isAuthenticated ? <ProtectedRoute><CustomerDashboard /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer/locations" element={isAuthenticated ? <ProtectedRoute><CustomerLocations /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer/locations/:locationId/floor-plans" element={isAuthenticated ? <ProtectedRoute><LocationFloorPlans /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer/requests" element={isAuthenticated ? <ProtectedRoute><CustomerRequests /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer/requests/:requestId" element={isAuthenticated ? <ProtectedRoute><RequestView /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer/service-orders" element={isAuthenticated ? <ProtectedRoute><CustomerServiceOrders /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer/service-orders/:orderId" element={isAuthenticated ? <ProtectedRoute><ServiceOrderView /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer/field-reports" element={isAuthenticated ? <ProtectedRoute><CustomerFieldReports /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer/field-reports/:reportId" element={isAuthenticated ? <ProtectedRoute><FieldReportView /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/customer/appointments/:appointmentId" element={isAuthenticated ? <ProtectedRoute><AppointmentView /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            {/* Access Denied Route */}
            <Route path="/access-denied" element={isAuthenticated ? <Suspense fallback={<RouteLoader />}><AccessDenied /></Suspense> : <Navigate to="/auth" replace />} />
            {/* Worker Mobile Routes */}
            <Route path="/worker/dashboard" element={isAuthenticated ? <ProtectedRoute><WorkerDashboard /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/profile" element={isAuthenticated ? <ProtectedRoute><WorkerProfile /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/supervisor/dashboard" element={isAuthenticated ? <ProtectedRoute><SupervisorProtectedRoute><SupervisorDashboard /></SupervisorProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/supervisor/map" element={isAuthenticated ? <ProtectedRoute><SupervisorProtectedRoute><SupervisorMapDashboard /></SupervisorProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/supervisor/appointments" element={isAuthenticated ? <ProtectedRoute><SupervisorProtectedRoute><SupervisorAppointments /></SupervisorProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/supervisor/service-orders" element={isAuthenticated ? <ProtectedRoute><SupervisorProtectedRoute><SupervisorServiceOrders /></SupervisorProtectedRoute></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/appointments" element={isAuthenticated ? <ProtectedRoute><WorkerAppointments /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/appointments/:id" element={isAuthenticated ? <ProtectedRoute><WorkerAppointmentDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/appointments/:id/request/:ticketId" element={isAuthenticated ? <ProtectedRoute><WorkerRequestDetails /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/time-logs" element={isAuthenticated ? <ProtectedRoute><WorkerTimeLogs /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/tasks" element={isAuthenticated ? <ProtectedRoute><WorkerTasks /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/calendar" element={isAuthenticated ? <ProtectedRoute><WorkerCalendar /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/field-report/:id" element={isAuthenticated ? <ProtectedRoute><WorkerFieldReport /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/field-report/:appointmentId/edit/:reportId" element={isAuthenticated ? <ProtectedRoute><EditFieldReport /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/field-report/:appointmentId/view/:reportId" element={isAuthenticated ? <ProtectedRoute><ViewFieldReport /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/field-report-new" element={isAuthenticated ? <ProtectedRoute><WorkerFieldReportStandalone /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/schedule" element={isAuthenticated ? <ProtectedRoute><WorkerSchedule /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/chat" element={isAuthenticated ? <ProtectedRoute><WorkerChat /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/worker/chat/:channelId" element={isAuthenticated ? <ProtectedRoute><WorkerChat /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            {/* Chat Routes */}
            <Route path="/chat" element={isAuthenticated ? <ProtectedRoute><Chat /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            <Route path="/chat/:channelId" element={isAuthenticated ? <ProtectedRoute><Chat /></ProtectedRoute> : <Navigate to="/auth" replace />} />
            {/* TV Display Routes */}
            {/* TV Display Routes - Now handled in public routes section with PIN gate */}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </BrowserRouter>
        </TooltipProvider>
          </ThemeProvider>
        </ViewModeProvider>
        </DataAccessLoggerProvider>
      </BrandColorsProvider>
    </QueryClientProvider>
  );
};

export default App;
