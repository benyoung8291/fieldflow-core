import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface CreateWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateWorkerDialog({ open, onOpenChange }: CreateWorkerDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createWorkerMutation = useMutation({
    mutationFn: async () => {
      // Get current user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Generate a random password
      const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

      // Create the user via admin API (Edge Function)
      const { data: newUser, error: createError } = await supabase.functions.invoke("create-worker", {
        body: {
          email,
          password: tempPassword,
          firstName,
          lastName,
          phone,
          tenantId: profile.tenant_id,
        },
      });

      if (createError) throw createError;
      if (!newUser?.userId) throw new Error("Failed to create user");

      return newUser.userId;
    },
    onSuccess: (userId) => {
      toast.success("Worker created successfully!");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      onOpenChange(false);
      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      // Navigate to worker details
      navigate(`/workers/${userId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create worker");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    createWorkerMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Worker</DialogTitle>
            <DialogDescription>
              Create a new user account and enable them as a worker. They will receive an email to set their password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createWorkerMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createWorkerMutation.isPending}>
              {createWorkerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Worker
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
