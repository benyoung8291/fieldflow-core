import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import premrestLogo from "@/assets/premrest-logo.svg";
import { AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function FirstPasswordReset() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validationResult = passwordSchema.safeParse({
        password,
        confirmPassword
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setIsLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: validationResult.data.password
      });

      if (updateError) throw updateError;

      // Mark password as reset in profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ needs_password_reset: false })
          .eq('id', user.id);

        if (profileError) throw profileError;
      }

      toast.success("Password updated successfully!");
      
      // Get user access info to redirect appropriately
      const { data: accessData } = await supabase.rpc('get_user_access_info');
      const access = Array.isArray(accessData) && accessData.length > 0 ? accessData[0] : null;
      
      navigate(access?.default_route || "/dashboard", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
      console.error("Password reset error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center mb-2">
            <img 
              src={premrestLogo} 
              alt="Premrest Logo" 
              className="h-8 w-auto object-contain"
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-center">Reset Your Password</h1>
            <CardDescription className="text-center">
              For security, you must set a new password before continuing
            </CardDescription>
          </div>
          
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <strong>Pro tip:</strong> Use Apple Passwords, Google Password Manager, or another password manager to generate and save a strong, random password.
            </AlertDescription>
          </Alert>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
