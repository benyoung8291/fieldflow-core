import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CustomerPortalUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  tenantId: string;
  user?: any;
}

interface UserFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password?: string;
}

export default function CustomerPortalUserDialog({
  open,
  onOpenChange,
  customerId,
  tenantId,
  user,
}: CustomerPortalUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserFormData>({
    defaultValues: user || {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset(user || {
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
      });
    }
  }, [open, user, reset]);

  const onSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    try {
      if (user) {
        // Update existing user
        const { error } = await supabase
          .from("customer_portal_users")
          .update({
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone,
          })
          .eq("id", user.id);

        if (error) throw error;
        toast.success("Portal user updated successfully");
      } else {
        // Create new user via edge function
        if (!data.password) {
          toast.error("Password is required");
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("You must be logged in");
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-user`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tenantId,
              customerId,
              firstName: data.first_name,
              lastName: data.last_name,
              email: data.email,
              phone: data.phone,
              password: data.password,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to create portal user");
        }

        toast.success("Portal user created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["customer-portal-users", customerId] });
      onOpenChange(false);
      reset();
    } catch (error: any) {
      console.error("Error saving portal user:", error);
      toast.error(error.message || "Failed to save portal user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Edit Portal User" : "Add Portal User"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                {...register("first_name", { required: "First name is required" })}
              />
              {errors.first_name && (
                <p className="text-sm text-destructive mt-1">{errors.first_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                {...register("last_name", { required: "Last name is required" })}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive mt-1">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address",
                },
              })}
              disabled={!!user}
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
            )}
            {user && (
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed after creation
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" {...register("phone")} />
          </div>

          {!user && (
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                {...register("password", {
                  required: !user ? "Password is required" : false,
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                })}
              />
              {errors.password && (
                <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                User will use this password to log in
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {user ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
