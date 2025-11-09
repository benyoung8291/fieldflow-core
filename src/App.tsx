import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import Dashboard from "./pages/Dashboard";
import Quotes from "./pages/Quotes";
import QuoteDetails from "./pages/QuoteDetails";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import ServiceOrders from "./pages/ServiceOrders";
import ServiceContracts from "./pages/ServiceContracts";
import ServiceContractDetails from "./pages/ServiceContractDetails";
import Scheduler from "./pages/Scheduler";
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

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/quotes" element={<ProtectedRoute><Quotes /></ProtectedRoute>} />
          <Route path="/quotes/:id" element={<ProtectedRoute><QuoteDetails /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
          <Route path="/service-orders" element={<ProtectedRoute><ServiceOrders /></ProtectedRoute>} />
          <Route path="/service-contracts" element={<ProtectedRoute><ServiceContracts /></ProtectedRoute>} />
          <Route path="/service-contracts/:id" element={<ProtectedRoute><ServiceContractDetails /></ProtectedRoute>} />
          <Route path="/scheduler" element={<ProtectedRoute><Scheduler /></ProtectedRoute>} />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
