import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FieldPresenceWrapper from "@/components/presence/FieldPresenceWrapper";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import RemoteCursors from "@/components/presence/RemoteCursors";
import { usePresence } from "@/hooks/usePresence";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const workerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  tax_file_number: z.string().optional(),
  abn: z.string().optional(),
  super_fund_name: z.string().optional(),
  super_fund_number: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  pay_rate_category_id: z.string().optional(),
  preferred_days: z.array(z.string()).optional(),
  preferred_start_time: z.string().optional(),
  preferred_end_time: z.string().optional(),
  is_active: z.boolean().default(true),
});

type WorkerFormData = z.infer<typeof workerSchema>;

interface WorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker?: any;
}

export default function WorkerDialog({ open, onOpenChange, worker }: WorkerDialogProps) {
  const queryClient = useQueryClient();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const { onlineUsers, updateCursorPosition, updateField } = usePresence({
    page: worker ? `worker-${worker.id}` : "worker-new"
  });

  const updateCursor = (e: React.MouseEvent) => {
    updateCursorPosition(e.clientX, e.clientY);
  };

  const form = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      phone: "",
      tax_file_number: "",
      abn: "",
      super_fund_name: "",
      super_fund_number: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      pay_rate_category_id: "",
      preferred_days: [],
      preferred_start_time: "",
      preferred_end_time: "",
      is_active: true,
    },
  });

  const { data: payRateCategories = [] } = useQuery({
    queryKey: ["pay-rate-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pay_rate_categories")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (worker) {
      form.reset({
        email: worker.email || "",
        first_name: worker.first_name || "",
        last_name: worker.last_name || "",
        phone: worker.phone || "",
        tax_file_number: worker.tax_file_number || "",
        abn: worker.abn || "",
        super_fund_name: worker.super_fund_name || "",
        super_fund_number: worker.super_fund_number || "",
        emergency_contact_name: worker.emergency_contact_name || "",
        emergency_contact_phone: worker.emergency_contact_phone || "",
        pay_rate_category_id: worker.pay_rate_category_id || "",
        preferred_days: worker.preferred_days || [],
        preferred_start_time: worker.preferred_start_time || "",
        preferred_end_time: worker.preferred_end_time || "",
        is_active: worker.is_active ?? true,
      });
      setSelectedDays(worker.preferred_days || []);
    } else {
      form.reset({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        phone: "",
        is_active: true,
      });
      setSelectedDays([]);
    }
  }, [worker, form]);

  const createWorker = useMutation({
    mutationFn: async (data: WorkerFormData) => {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password!,
        email_confirm: true,
        user_metadata: {
          first_name: data.first_name,
          last_name: data.last_name,
        },
      });

      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          phone: data.phone,
          tax_file_number: data.tax_file_number,
          abn: data.abn,
          super_fund_name: data.super_fund_name,
          super_fund_number: data.super_fund_number,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone,
          pay_rate_category_id: data.pay_rate_category_id || null,
          preferred_days: selectedDays,
          preferred_start_time: data.preferred_start_time || null,
          preferred_end_time: data.preferred_end_time || null,
          is_active: data.is_active,
        })
        .eq("id", authData.user.id);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker created successfully");
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create worker");
    },
  });

  const updateWorker = useMutation({
    mutationFn: async (data: WorkerFormData) => {
      if (data.password) {
        const { error: authError } = await supabase.auth.admin.updateUserById(worker.id, {
          password: data.password,
        });
        if (authError) throw authError;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          tax_file_number: data.tax_file_number,
          abn: data.abn,
          super_fund_name: data.super_fund_name,
          super_fund_number: data.super_fund_number,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone,
          pay_rate_category_id: data.pay_rate_category_id || null,
          preferred_days: selectedDays,
          preferred_start_time: data.preferred_start_time || null,
          preferred_end_time: data.preferred_end_time || null,
          is_active: data.is_active,
        })
        .eq("id", worker.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker updated successfully");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update worker");
    },
  });

  const onSubmit = (data: WorkerFormData) => {
    if (worker) {
      updateWorker.mutate(data);
    } else {
      createWorker.mutate(data);
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onMouseMove={updateCursor}>
        <RemoteCursors users={onlineUsers} />
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{worker ? "Edit Worker" : "Add Worker"}</DialogTitle>
            <PresenceIndicator users={onlineUsers} />
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="payroll">Payroll & Tax</TabsTrigger>
                <TabsTrigger value="preferences">Preferences</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <FieldPresenceWrapper fieldName="email" onlineUsers={onlineUsers}>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            disabled={!!worker}
                            onFocus={() => updateField("email")}
                            onBlur={() => updateField(null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FieldPresenceWrapper>

                {!worker && (
                  <FieldPresenceWrapper fieldName="password" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              onFocus={() => updateField("password")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>
                )}

                {worker && (
                  <FieldPresenceWrapper fieldName="password" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password (leave blank to keep current)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter new password"
                              onFocus={() => updateField("password")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FieldPresenceWrapper fieldName="first_name" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onFocus={() => updateField("first_name")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>

                  <FieldPresenceWrapper fieldName="last_name" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onFocus={() => updateField("last_name")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>
                </div>

                <FieldPresenceWrapper fieldName="phone" onlineUsers={onlineUsers}>
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            onFocus={() => updateField("phone")}
                            onBlur={() => updateField(null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FieldPresenceWrapper>

                <div className="grid grid-cols-2 gap-4">
                  <FieldPresenceWrapper fieldName="emergency_contact_name" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="emergency_contact_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onFocus={() => updateField("emergency_contact_name")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>

                  <FieldPresenceWrapper fieldName="emergency_contact_phone" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="emergency_contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Phone</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onFocus={() => updateField("emergency_contact_phone")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>
                </div>

                <FieldPresenceWrapper fieldName="is_active" onlineUsers={onlineUsers}>
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active Status</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Inactive workers cannot log in or be assigned to jobs
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </FieldPresenceWrapper>
              </TabsContent>

              <TabsContent value="payroll" className="space-y-4">
                <FieldPresenceWrapper fieldName="pay_rate_category_id" onlineUsers={onlineUsers}>
                  <FormField
                    control={form.control}
                    name="pay_rate_category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pay Rate Category</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          onOpenChange={(open) => {
                            if (open) updateField("pay_rate_category_id");
                            else updateField(null);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select pay rate category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {payRateCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name} - ${category.hourly_rate}/hr
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FieldPresenceWrapper>

                <div className="grid grid-cols-2 gap-4">
                  <FieldPresenceWrapper fieldName="tax_file_number" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="tax_file_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax File Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onFocus={() => updateField("tax_file_number")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>

                  <FieldPresenceWrapper fieldName="abn" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="abn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ABN</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onFocus={() => updateField("abn")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FieldPresenceWrapper fieldName="super_fund_name" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="super_fund_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Superannuation Fund Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onFocus={() => updateField("super_fund_name")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>

                  <FieldPresenceWrapper fieldName="super_fund_number" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="super_fund_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Superannuation Fund Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onFocus={() => updateField("super_fund_number")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>
                </div>
              </TabsContent>

              <TabsContent value="preferences" className="space-y-4">
                <div>
                  <FormLabel>Preferred Days</FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day}
                        type="button"
                        variant={selectedDays.includes(day) ? "default" : "outline"}
                        onClick={() => toggleDay(day)}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FieldPresenceWrapper fieldName="preferred_start_time" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="preferred_start_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Start Time</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="time"
                              onFocus={() => updateField("preferred_start_time")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>

                  <FieldPresenceWrapper fieldName="preferred_end_time" onlineUsers={onlineUsers}>
                    <FormField
                      control={form.control}
                      name="preferred_end_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred End Time</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="time"
                              onFocus={() => updateField("preferred_end_time")}
                              onBlur={() => updateField(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </FieldPresenceWrapper>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createWorker.isPending || updateWorker.isPending}>
                {worker ? "Update" : "Create"} Worker
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
