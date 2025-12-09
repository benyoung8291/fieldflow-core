import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import premrestLogo from "@/assets/premrest-logo.svg";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export default function Auth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Check if user is already authenticated on mount
  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      const timestamp = new Date().toISOString();
      console.log(`🔐 [${timestamp}] AUTH_CHECK: Starting session check on mount`);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted && session) {
          console.log(`🔐 [${timestamp}] AUTH_CHECK: Active session found`, {
            userId: session.user.id,
            email: session.user.email,
            sessionExpiry: session.expires_at,
          });
          
          // Get user's actual access info to determine correct route
          const { data: accessData, error: accessError } = await supabase.rpc('get_user_access_info');
          
          if (accessError) {
            console.error(`🚫 [${timestamp}] AUTH_CHECK: Access RPC failed`, {
              error: accessError.message,
              code: accessError.code,
              userId: session.user.id,
            });
            setIsCheckingAuth(false);
            return;
          }
          
          const access = Array.isArray(accessData) && accessData.length > 0 ? accessData[0] : null;
          
          console.log(`🔐 [${timestamp}] AUTH_CHECK: Access data retrieved`, {
            hasAccessData: !!access,
            hasRole: access?.has_role,
            isWorker: access?.is_worker,
            isCustomer: access?.is_customer,
            canAccessOffice: access?.can_access_office,
            canAccessWorker: access?.can_access_worker,
            canAccessCustomerPortal: access?.can_access_customer_portal,
            defaultRoute: access?.default_route,
            showToggle: access?.show_toggle,
          });
          
          if (access) {
            console.log(`✅ [${timestamp}] AUTH_CHECK: Redirecting authenticated user`, {
              userId: session.user.id,
              destination: access.default_route,
            });
            navigate(access.default_route, { replace: true });
          } else {
            console.warn(`⚠️ [${timestamp}] AUTH_CHECK: No access data - showing login`, {
              userId: session.user.id,
            });
            setIsCheckingAuth(false);
          }
        } else {
          console.log(`🔐 [${timestamp}] AUTH_CHECK: No active session - showing login`);
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error(`🚫 [${timestamp}] AUTH_CHECK: Unexpected error`, error);
        if (mounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    checkAuth();
    
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const timestamp = new Date().toISOString();
    const loginAttemptId = Math.random().toString(36).substring(7);

    console.log(`🔐 [${timestamp}] LOGIN_START: Attempt ${loginAttemptId}`, { email });

    try {
      // Validate sign-in inputs
      const validationResult = signInSchema.safeParse({
        email,
        password
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        console.log(`🚫 [${timestamp}] LOGIN_VALIDATION_FAILED: ${loginAttemptId}`, {
          error: firstError.message,
        });
        toast.error(firstError.message);
        setIsLoading(false);
        return;
      }

      console.log(`🔐 [${timestamp}] LOGIN_AUTH: Calling signInWithPassword ${loginAttemptId}`);
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      if (error) {
        console.error(`🚫 [${timestamp}] LOGIN_AUTH_FAILED: ${loginAttemptId}`, {
          error: error.message,
          code: error.status,
        });
        toast.error("Invalid email or password.");
        setIsLoading(false);
        return;
      }

      const userId = signInData?.user?.id;
      console.log(`✅ [${timestamp}] LOGIN_AUTH_SUCCESS: ${loginAttemptId}`, {
        userId,
        email: signInData?.user?.email,
      });

      // Get user access using the RPC function
      console.log(`🔐 [${timestamp}] LOGIN_ACCESS_CHECK: Fetching access info ${loginAttemptId}`);
      const { data: accessData, error: accessError } = await supabase.rpc('get_user_access_info');

      if (accessError) {
        console.error(`🚫 [${timestamp}] LOGIN_ACCESS_RPC_FAILED: ${loginAttemptId}`, {
          error: accessError.message,
          code: accessError.code,
          userId,
        });
        toast.error("Access verification error. Please try again.");
        setIsLoading(false);
        return;
      }

      // RPC functions return arrays, get first result
      const access = Array.isArray(accessData) && accessData.length > 0 ? accessData[0] : null;

      // Comprehensive access logging
      console.log(`🔐 [${timestamp}] LOGIN_ACCESS_RESULT: ${loginAttemptId}`, {
        userId,
        hasAccessData: !!access,
        rawAccessData: access,
        accessFlags: {
          hasRole: access?.has_role,
          isWorker: access?.is_worker,
          isCustomer: access?.is_customer,
          canAccessOffice: access?.can_access_office,
          canAccessWorker: access?.can_access_worker,
          canAccessCustomerPortal: access?.can_access_customer_portal,
        },
        routing: {
          defaultRoute: access?.default_route,
          showToggle: access?.show_toggle,
          customerId: access?.customer_id,
        },
      });

      if (!access) {
        console.error(`🚫 [${timestamp}] LOGIN_NO_ACCESS: ${loginAttemptId}`, {
          userId,
          action: 'SIGNING_OUT',
          reason: 'No access data returned from RPC',
        });
        toast.error("Your account setup is incomplete. Please contact your administrator.");
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      // SECURITY: Verify user has at least one access flag
      if (!access.can_access_office && !access.can_access_worker && !access.can_access_customer_portal) {
        console.error(`🚫 [${timestamp}] LOGIN_NO_ACCESS_FLAGS: ${loginAttemptId}`, {
          userId: access.user_id,
          hasRole: access.has_role,
          action: 'SIGNING_OUT',
          reason: 'User has no access flags (can_access_office/worker/customer_portal all false)',
        });
        toast.error("Your account setup is incomplete. Please contact your administrator.");
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      // SECURITY: Verify default route is valid for the user's access level
      if (access.default_route === '/dashboard' && !access.can_access_office) {
        console.error(`🚫 [${timestamp}] LOGIN_ROUTE_MISMATCH: ${loginAttemptId}`, {
          userId: access.user_id,
          defaultRoute: access.default_route,
          canAccessOffice: access.can_access_office,
          action: 'SIGNING_OUT',
          reason: 'Worker-only user has office route assigned',
        });
        toast.error("Access configuration error. Please contact your administrator.");
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      // Check if user needs to reset password
      console.log(`🔐 [${timestamp}] LOGIN_PASSWORD_CHECK: Checking password reset status ${loginAttemptId}`);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('needs_password_reset')
          .eq('id', currentUser.id)
          .single();

        if (profileData?.needs_password_reset) {
          console.log(`🔐 [${timestamp}] LOGIN_PASSWORD_RESET_REQUIRED: ${loginAttemptId}`, {
            userId: currentUser.id,
            redirectTo: '/first-password-reset',
          });
          toast.info("Please reset your password to continue");
          navigate("/first-password-reset", { replace: true });
          setIsLoading(false);
          return;
        }
      }

      // Clear cached access data to ensure fresh data
      queryClient.removeQueries({ queryKey: ["user-access"] });
      
      console.log(`✅ [${timestamp}] LOGIN_SUCCESS: ${loginAttemptId}`, {
        userId,
        email: signInData?.user?.email,
        destination: access.default_route,
        accessProfile: {
          hasRole: access.has_role,
          isWorker: access.is_worker,
          isCustomer: access.is_customer,
          canAccessOffice: access.can_access_office,
          canAccessWorker: access.can_access_worker,
          canAccessCustomerPortal: access.can_access_customer_portal,
          showToggle: access.show_toggle,
        },
      });
      
      // Show success and redirect to appropriate dashboard
      toast.success("Welcome back!");
      navigate(access.default_route, { replace: true });
    } catch (error: any) {
      console.error(`🚫 [${timestamp}] LOGIN_UNEXPECTED_ERROR: ${loginAttemptId}`, {
        error: error.message,
        stack: error.stack,
      });
      toast.error("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={premrestLogo} 
              alt="Premrest Logo" 
              className="h-8 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-semibold text-center">Sign In</h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter your credentials to continue
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Loading..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
