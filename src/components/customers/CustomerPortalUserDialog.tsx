import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  portal_role: "full_access" | "supervisor" | "basic";
}

export default function CustomerPortalUserDialog({
  open,
  onOpenChange,
  customerId,
  tenantId,
  user,
}: CustomerPortalUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"full_access" | "supervisor" | "basic">("basic");
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserFormData>({
    defaultValues: user || {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      portal_role: "basic",
    },
  });

  useEffect(() => {
    if (open) {
      const defaultRole = user?.portal_role || "basic";
      setSelectedRole(defaultRole);
      reset(user || {
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        portal_role: "basic",
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
            portal_role: selectedRole,
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

        console.log("Invoking create-customer-portal-user function with:", {
          tenantId,
          customerId,
          email: data.email,
        });
        
        const { data: result, error: functionError } = await supabase.functions.invoke(
          "create-customer-portal-user",
          {
            body: {
              tenantId,
              customerId,
              firstName: data.first_name,
              lastName: data.last_name,
              email: data.email,
              phone: data.phone,
              password: data.password,
              portalRole: selectedRole,
            },
          }
        );

        console.log("Function response received:", { 
          hasResult: !!result, 
          hasError: !!functionError,
          resultData: result,
          errorDetails: functionError 
        });

        if (functionError) {
          console.error("Function invocation error:", functionError);
          const errorMsg = functionError.message || "Failed to invoke function";
          toast.error(`Failed to create portal user: ${errorMsg}`);
          throw new Error(errorMsg);
        }

        if (result?.error) {
          console.error("Function returned error:", result.error);
          const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
          toast.error(`Failed to create portal user: ${errorMsg}`);
          throw new Error(errorMsg);
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

          <div>
            <Label htmlFor="portal_role">Portal Role *</Label>
            <Select value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic User</SelectItem>
                <SelectItem value="supervisor">Supervisor User</SelectItem>
                <SelectItem value="full_access">Full Portal User</SelectItem>
              </SelectContent>
            </Select>
            <Alert className="mt-2">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {selectedRole === "basic" && "Can create requests and markup floor plans only"}
                {selectedRole === "supervisor" && "Can create requests, markup floor plans, and view past requests and field reports"}
                {selectedRole === "full_access" && "Full access including financial data, invoices, and contracts"}
              </AlertDescription>
            </Alert>
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
