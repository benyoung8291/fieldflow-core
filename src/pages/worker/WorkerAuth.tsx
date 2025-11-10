import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { Briefcase } from "lucide-react";

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export default function WorkerAuth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        // Use generic error message to prevent user enumeration
        toast.error("Invalid email or password.");
        console.error("Sign in error:", error);
        return;
      }

      // Store login type preference
      localStorage.setItem("loginType", "worker");
      
      toast.success("Welcome back!");
      navigate("/worker/dashboard");
    } catch (error: any) {
      // Generic error message for unexpected errors
      toast.error("An unexpected error occurred. Please try again.");
      console.error("Auth error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center">
              <Briefcase className="text-primary-foreground h-8 w-8" />
            </div>
          </div>
          <CardTitle className="text-3xl text-center font-bold">
            Field Worker Login
          </CardTitle>
          <CardDescription className="text-center text-base">
            Sign in to access your mobile dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 text-base"
                placeholder="your.email@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 text-base"
                placeholder="Enter your password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold" 
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Not a field worker?
              </span>
            </div>
          </div>
          
          <div className="text-center">
            <Link
              to="/auth"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              Login as office/admin user
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
