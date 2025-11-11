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
import premrestLogo from "@/assets/premrest-logo.svg";

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
            <img 
              src={premrestLogo} 
              alt="Premrest Logo" 
              className="h-8 w-auto object-contain"
            />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Field Worker Login</span>
          </div>
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
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Sign In"}
            </Button>
          </form>
          
          <div className="mt-6 text-center space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Office User?
                </span>
              </div>
            </div>
            
            <Link
              to="/auth"
              className="block"
            >
              <Button variant="outline" className="w-full" type="button">
                Login as Office User
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
