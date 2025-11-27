import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, X } from "lucide-react";
import { AUSTRALIAN_STATES } from "@/lib/constants/australianStates";

interface UserDetailsDialogProps {
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserDetailsDialog = ({ user, open, onOpenChange }: UserDetailsDialogProps) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user.email);
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [phone, setPhone] = useState(user.worker_phone || "");
  const [state, setState] = useState(user.worker_state || "");

  const updateUserMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) throw new Error("Not authenticated");

      // Update email via edge function if changed
      if (updates.email && updates.email !== user.email) {
        const emailResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-email`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: user.id, email: updates.email }),
          }
        );

        if (!emailResponse.ok) {
          const error = await emailResponse.json();
          throw new Error(error.error || 'Failed to update email');
        }
      }

      // Update profile data
      const profileUpdates: any = {};
      if (updates.first_name !== user.first_name) profileUpdates.first_name = updates.first_name;
      if (updates.last_name !== user.last_name) profileUpdates.last_name = updates.last_name;
      if (updates.worker_phone !== user.worker_phone) profileUpdates.worker_phone = updates.worker_phone;
      if (updates.worker_state !== user.worker_state) profileUpdates.worker_state = updates.worker_state;

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", user.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated successfully");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  const handleSave = () => {
    if (!email || !firstName) {
      toast.error("Email and first name are required");
      return;
    }

    updateUserMutation.mutate({
      email,
      first_name: firstName,
      last_name: lastName,
      worker_phone: phone,
      worker_state: state,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Worker Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+61 XXX XXX XXX"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">Worker State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {AUSTRALIAN_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-2">
              {user.roles?.length > 0 ? (
                user.roles.map((role: string) => (
                  <Badge key={role} variant="secondary">
                    {role.replace(/_/g, " ")}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No roles assigned</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Teams</Label>
            <div className="flex flex-wrap gap-2">
              {user.teams?.length > 0 ? (
                user.teams.map((team: any) => (
                  <Badge key={team.id} variant="outline">
                    {team.name}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No teams assigned</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Badge variant={user.is_active ? "default" : "secondary"}>
              {user.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateUserMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
