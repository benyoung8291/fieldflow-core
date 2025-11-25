import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Check if user is already authenticated on mount - simplified
  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted && session) {
          // User is already authenticated - redirect to dashboard
          // ProtectedRoute will handle the proper routing based on access
          navigate("/dashboard", { replace: true });
        } else {
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
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

    try {
      // Validate sign-in inputs
      const validationResult = signInSchema.safeParse({
        email,
        password
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      if (error) {
        toast.error("Invalid email or password.");
        console.error("Sign in error:", error);
        setIsLoading(false);
        return;
      }

      // Get user access using the RPC function
      const { data: accessData, error: accessError } = await supabase.rpc('get_user_access_info');

      if (accessError) {
        console.error("Access check error:", accessError);
        toast.error("Failed to verify access. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!accessData || (Array.isArray(accessData) && accessData.length === 0)) {
        toast.error("Access denied. Please contact your administrator.");
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      const access = Array.isArray(accessData) ? accessData[0] : accessData;

      // Check if user has any access
      if (!access.can_access_office && !access.can_access_worker) {
        toast.error("Access denied. Please contact your administrator.");
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      // Show success and redirect to appropriate dashboard
      toast.success("Welcome back!");
      navigate(access.default_route, { replace: true });
    } catch (error: any) {
      toast.error("An unexpected error occurred. Please try again.");
      console.error("Auth error:", error);
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
