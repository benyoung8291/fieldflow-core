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
import { useOfflineSync } from "./hooks/useOfflineSync";
import { useOfflineSyncOffice } from "./hooks/useOfflineSyncOffice";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Initialize PWA and offline sync for both worker and office apps
  usePWAUpdate();
  useOfflineSync();
  useOfflineSyncOffice();

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
        <ThemeProvider>
          <div className="flex items-center justify-center min-h-screen">Loading...</div>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Auth />} />
            <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/auth" replace />} />
            <Route path="/users" element={isAuthenticated ? <UserManagement /> : <Navigate to="/auth" replace />} />
            <Route path="/quotes" element={isAuthenticated ? <Quotes /> : <Navigate to="/auth" replace />} />
            <Route path="/quotes/:id" element={isAuthenticated ? <QuoteDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/projects" element={isAuthenticated ? <Projects /> : <Navigate to="/auth" replace />} />
            <Route path="/projects/:id" element={isAuthenticated ? <ProjectDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/service-orders" element={isAuthenticated ? <ServiceOrders /> : <Navigate to="/auth" replace />} />
            <Route path="/service-orders/:id" element={isAuthenticated ? <ServiceOrderDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/service-contracts" element={isAuthenticated ? <ServiceContracts /> : <Navigate to="/auth" replace />} />
            <Route path="/service-contracts/:id" element={isAuthenticated ? <ServiceContractDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/scheduler" element={isAuthenticated ? <Scheduler /> : <Navigate to="/auth" replace />} />
            <Route path="/appointments" element={isAuthenticated ? <Appointments /> : <Navigate to="/auth" replace />} />
            <Route path="/appointments/:id" element={isAuthenticated ? <AppointmentDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/customers" element={isAuthenticated ? <Customers /> : <Navigate to="/auth" replace />} />
            <Route path="/customers/:id" element={isAuthenticated ? <CustomerDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/customer-locations/:id" element={isAuthenticated ? <CustomerLocationDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/leads" element={isAuthenticated ? <Leads /> : <Navigate to="/auth" replace />} />
            <Route path="/leads/:id" element={isAuthenticated ? <LeadDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/workers" element={isAuthenticated ? <Workers /> : <Navigate to="/auth" replace />} />
            <Route path="/workers/:id" element={isAuthenticated ? <WorkerDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/skills" element={isAuthenticated ? <Skills /> : <Navigate to="/auth" replace />} />
            <Route path="/training-matrix" element={isAuthenticated ? <TrainingMatrix /> : <Navigate to="/auth" replace />} />
            <Route path="/analytics" element={isAuthenticated ? <Analytics /> : <Navigate to="/auth" replace />} />
            <Route path="/pipeline" element={isAuthenticated ? <QuotePipeline /> : <Navigate to="/auth" replace />} />
            <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/auth" replace />} />
            <Route path="/tasks" element={isAuthenticated ? <Tasks /> : <Navigate to="/auth" replace />} />
            <Route path="/invoices" element={isAuthenticated ? <InvoicesList /> : <Navigate to="/auth" replace />} />
            <Route path="/invoices/create" element={isAuthenticated ? <Invoices /> : <Navigate to="/auth" replace />} />
            <Route path="/invoices/:id" element={isAuthenticated ? <InvoiceDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/recurring-invoices" element={isAuthenticated ? <RecurringInvoices /> : <Navigate to="/auth" replace />} />
            <Route path="/recurring-invoices/:id" element={isAuthenticated ? <RecurringInvoiceDetails /> : <Navigate to="/auth" replace />} />
            <Route path="/helpdesk" element={isAuthenticated ? <HelpDesk /> : <Navigate to="/auth" replace />} />
            {/* Worker Mobile Routes */}
            <Route path="/worker/auth" element={isAuthenticated ? <Navigate to="/worker/dashboard" replace /> : <WorkerAuth />} />
            <Route path="/worker/dashboard" element={isAuthenticated ? <WorkerDashboard /> : <Navigate to="/worker/auth" replace />} />
            <Route path="/worker/supervisor/dashboard" element={isAuthenticated ? <SupervisorDashboard /> : <Navigate to="/worker/auth" replace />} />
            <Route path="/worker/supervisor/map" element={isAuthenticated ? <SupervisorMapDashboard /> : <Navigate to="/worker/auth" replace />} />
            <Route path="/worker/supervisor/appointments" element={isAuthenticated ? <SupervisorAppointments /> : <Navigate to="/worker/auth" replace />} />
            <Route path="/worker/supervisor/service-orders" element={isAuthenticated ? <SupervisorServiceOrders /> : <Navigate to="/worker/auth" replace />} />
            <Route path="/worker/appointments" element={isAuthenticated ? <WorkerAppointments /> : <Navigate to="/worker/auth" replace />} />
            <Route path="/worker/appointments/:id" element={isAuthenticated ? <WorkerAppointmentDetails /> : <Navigate to="/worker/auth" replace />} />
            <Route path="/worker/schedule" element={isAuthenticated ? <WorkerSchedule /> : <Navigate to="/worker/auth" replace />} />
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
