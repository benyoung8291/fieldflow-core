import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LinkUserAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  workerName: string;
}

export default function LinkUserAccountDialog({
  open,
  onOpenChange,
  workerId,
  workerName,
}: LinkUserAccountDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords are identical",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get current user's tenant_id
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", currentUser.id)
        .single();

      if (!currentProfile?.tenant_id) {
        throw new Error("Unable to determine tenant");
      }

      // Get the worker's current profile data
      const { data: workerProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", workerId)
        .single();

      if (!workerProfile) {
        throw new Error("Worker profile not found");
      }

      // Create a new auth user via edge function or admin API
      // Note: This requires a service role key, so we'll use an edge function
      const { data: newUser, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: workerProfile.first_name,
            last_name: workerProfile.last_name,
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!newUser.user) throw new Error("Failed to create user account");

      // Update the existing profile with the new user ID
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          id: newUser.user.id,
          tenant_id: currentProfile.tenant_id,
        })
        .eq("id", workerId);

      if (updateError) {
        // If profile update fails, we should clean up the auth user
        // This would ideally be done via an edge function with proper error handling
        console.error("Failed to update profile:", updateError);
        throw new Error("Failed to link user account to worker profile");
      }

      toast({
        title: "User account created",
        description: `Login credentials have been created for ${workerName}`,
      });

      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["worker", workerId] });
      
      onOpenChange(false);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error creating user account:", error);
      toast({
        title: "Error creating user account",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create User Account
          </DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Create login credentials for <strong>{workerName}</strong> to access the system.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="worker@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
