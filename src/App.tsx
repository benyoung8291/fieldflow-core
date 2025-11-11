import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import Dashboard from "./pages/Dashboard";
import Quotes from "./pages/Quotes";
import QuoteDetails from "./pages/QuoteDetails";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import ServiceOrders from "./pages/ServiceOrders";
import ServiceOrderDetails from "./pages/ServiceOrderDetails";
import ServiceContracts from "./pages/ServiceContracts";
import ServiceContractDetails from "./pages/ServiceContractDetails";
import Scheduler from "./pages/Scheduler";
import Appointments from "./pages/Appointments";
import AppointmentDetails from "./pages/AppointmentDetails";
import Customers from "./pages/Customers";
import CustomerDetails from "./pages/CustomerDetails";
import CustomerLocationDetails from "./pages/CustomerLocationDetails";
import Leads from "./pages/Leads";
import LeadDetails from "./pages/LeadDetails";
import Workers from "./pages/Workers";
import WorkerDetails from "./pages/WorkerDetails";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import QuotePipeline from "./pages/QuotePipeline";
import Tasks from "./pages/Tasks";
import NotFound from "./pages/NotFound";
import Skills from "./pages/Skills";
import TrainingMatrix from "./pages/TrainingMatrix";
import Invoices from "./pages/Invoices";
import InvoicesList from "./pages/InvoicesList";
import InvoiceDetails from "./pages/InvoiceDetails";
import RecurringInvoices from "./pages/RecurringInvoices";
import RecurringInvoiceDetails from "./pages/RecurringInvoiceDetails";
import HelpDesk from "./pages/HelpDesk";
import WorkerDashboard from "./pages/worker/WorkerDashboard";
import WorkerAuth from "./pages/worker/WorkerAuth";
import WorkerAppointments from "./pages/worker/WorkerAppointments";
import WorkerAppointmentDetails from "./pages/worker/WorkerAppointmentDetails";
import WorkerSchedule from "./pages/worker/WorkerSchedule";
import SupervisorDashboard from "./pages/worker/supervisor/SupervisorDashboard";
import SupervisorMapDashboard from "./pages/worker/supervisor/SupervisorMapDashboard";
import SupervisorAppointments from "./pages/worker/supervisor/SupervisorAppointments";
import SupervisorServiceOrders from "./pages/worker/supervisor/SupervisorServiceOrders";
import { usePWAUpdate } from "./hooks/usePWAUpdate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    
    // Check if OAuth flag is stuck (older than 5 minutes)
    const oauthFlag = localStorage.getItem('oauth_in_progress');
    if (oauthFlag === 'true') {
      console.warn("⚠️ Found stuck oauth_in_progress flag on mount, clearing it");
      localStorage.removeItem('oauth_in_progress');
      localStorage.removeItem('oauth_session_key');
    }
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mounted && isAuthenticated === null) {
        console.error("Authentication check timed out");
        setIsAuthenticated(false);
      }
    }, 10000); // 10 second timeout

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
      console.log(`🔐 [${timestamp}] Auth event received:`, event);
      console.log(`🔐 [${timestamp}] Session exists:`, !!session);
      console.log(`🔐 [${timestamp}] Current isAuthenticated:`, isAuthenticated);
      
      // CRITICAL: Ignore ALL auth state changes during OAuth popup flow
      const oauthInProgress = localStorage.getItem('oauth_in_progress');
      if (oauthInProgress === 'true') {
        console.log(`⏭️ [${timestamp}] BLOCKED - OAuth in progress`);
        return;
      }
      
      // ULTRA STRICT: Only react to SIGNED_IN and SIGNED_OUT
      // Ignore EVERYTHING else including TOKEN_REFRESHED, USER_UPDATED, etc.
      
      if (event === 'SIGNED_IN') {
        console.log(`✅ [${timestamp}] SIGNED_IN - setting authenticated to TRUE`);
        if (mounted) {
          setIsAuthenticated(true);
        }
        return;
      }
      
      if (event === 'SIGNED_OUT') {
        console.log(`🚪 [${timestamp}] SIGNED_OUT - setting authenticated to FALSE`);
        if (mounted) {
          setIsAuthenticated(false);
        }
        return;
      }
      
      // For ALL other events, do NOTHING - don't change authentication state
      console.log(`⏭️ [${timestamp}] IGNORED event "${event}" - no action taken`);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

const App = () => {
  // Initialize PWA update functionality
  usePWAUpdate();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
            <Route path="/quotes/:id" element={<ProtectedRoute><QuoteDetails /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
            <Route path="/service-orders" element={<ProtectedRoute><ServiceOrders /></ProtectedRoute>} />
            <Route path="/service-orders/:id" element={<ProtectedRoute><ServiceOrderDetails /></ProtectedRoute>} />
            <Route path="/service-contracts" element={<ProtectedRoute><ServiceContracts /></ProtectedRoute>} />
            <Route path="/service-contracts/:id" element={<ProtectedRoute><ServiceContractDetails /></ProtectedRoute>} />
            <Route path="/scheduler" element={<ProtectedRoute><Scheduler /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
            <Route path="/appointments/:id" element={<ProtectedRoute><AppointmentDetails /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetails /></ProtectedRoute>} />
            <Route path="/customer-locations/:id" element={<ProtectedRoute><CustomerLocationDetails /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetails /></ProtectedRoute>} />
            <Route path="/workers" element={<ProtectedRoute><Workers /></ProtectedRoute>} />
            <Route path="/workers/:id" element={<ProtectedRoute><WorkerDetails /></ProtectedRoute>} />
            <Route path="/skills" element={<ProtectedRoute><Skills /></ProtectedRoute>} />
            <Route path="/training-matrix" element={<ProtectedRoute><TrainingMatrix /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute><QuotePipeline /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><InvoicesList /></ProtectedRoute>} />
            <Route path="/invoices/create" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetails /></ProtectedRoute>} />
            <Route path="/recurring-invoices" element={<ProtectedRoute><RecurringInvoices /></ProtectedRoute>} />
            <Route path="/recurring-invoices/:id" element={<ProtectedRoute><RecurringInvoiceDetails /></ProtectedRoute>} />
            <Route path="/helpdesk" element={<ProtectedRoute><HelpDesk /></ProtectedRoute>} />
            {/* Worker Mobile Routes */}
            <Route path="/worker/auth" element={<WorkerAuth />} />
            <Route path="/worker/dashboard" element={<ProtectedRoute><WorkerDashboard /></ProtectedRoute>} />
            <Route path="/worker/supervisor/dashboard" element={<ProtectedRoute><SupervisorDashboard /></ProtectedRoute>} />
            <Route path="/worker/supervisor/map" element={<ProtectedRoute><SupervisorMapDashboard /></ProtectedRoute>} />
            <Route path="/worker/supervisor/appointments" element={<ProtectedRoute><SupervisorAppointments /></ProtectedRoute>} />
            <Route path="/worker/supervisor/service-orders" element={<ProtectedRoute><SupervisorServiceOrders /></ProtectedRoute>} />
            <Route path="/worker/appointments" element={<ProtectedRoute><WorkerAppointments /></ProtectedRoute>} />
            <Route path="/worker/appointments/:id" element={<ProtectedRoute><WorkerAppointmentDetails /></ProtectedRoute>} />
            <Route path="/worker/schedule" element={<ProtectedRoute><WorkerSchedule /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
