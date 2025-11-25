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

  // Check if user is already authenticated and redirect appropriately
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsCheckingAuth(false);
        return;
      }

      // Check access
      const { data: roleData } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: workerData } = await (supabase as any)
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const hasRole = !!roleData;
      const isWorker = !!workerData;

      if (hasRole) {
        navigate("/dashboard", { replace: true });
      } else if (isWorker) {
        navigate("/worker/dashboard", { replace: true });
      } else {
        // User is authenticated but has no access
        await supabase.auth.signOut();
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
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
        return;
      }

      // Get user access to determine redirect
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: workerData } = await (supabase as any)
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const hasRole = !!roleData;
      const isWorker = !!workerData;

      toast.success("Welcome back!");
      
      // Redirect based on access
      if (hasRole) {
        navigate("/dashboard");
      } else if (isWorker) {
        navigate("/worker/dashboard");
      } else {
        toast.error("Access denied. Please contact your administrator.");
        await supabase.auth.signOut();
      }
    } catch (error: any) {
      // Generic error message for unexpected errors
      toast.error("An unexpected error occurred. Please try again.");
      console.error("Auth error:", error);
    } finally {
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
