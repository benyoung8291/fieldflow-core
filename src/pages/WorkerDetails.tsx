import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, DollarSign, Mail, Phone, User, Shield } from "lucide-react";
import AuditDrawer from "@/components/audit/AuditDrawer";
import AuditTimeline from "@/components/audit/AuditTimeline";
import WorkerAvailability from "@/components/workers/WorkerAvailability";
import WorkerSkillsTab from "@/components/workers/WorkerSkillsTab";
import WorkerCertificatesTab from "@/components/workers/WorkerCertificatesTab";
import WorkerLicensesTab from "@/components/workers/WorkerLicensesTab";
import WorkerTrainingTab from "@/components/workers/WorkerTrainingTab";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import RemoteCursors from "@/components/presence/RemoteCursors";
import { usePresence } from "@/hooks/usePresence";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WorkerDetails() {
  const { id } = useParams<{ id: string }>();
  const { onlineUsers, updateCursorPosition } = usePresence({ page: `worker-${id}` });
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const updateCursor = (e: React.MouseEvent) => {
    updateCursorPosition(e.clientX, e.clientY);
  };

  const { data: worker, isLoading } = useQuery({
    queryKey: ["worker", id],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(`
          *,
          pay_rate_category:pay_rate_categories(name, hourly_rate)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return profile;
    },
    enabled: !!id,
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

  const updateWorkerMutation = useMutation({
    mutationFn: async (data: any) => {
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
          preferred_days: data.preferred_days,
          preferred_start_time: data.preferred_start_time || null,
          preferred_end_time: data.preferred_end_time || null,
          is_active: data.is_active,
          employment_type: data.employment_type,
          standard_work_hours: data.standard_work_hours ? parseFloat(data.standard_work_hours) : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker", id] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker updated successfully");
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update worker");
    },
  });

  const handleEdit = () => {
    setFormData({
      first_name: worker?.first_name || "",
      last_name: worker?.last_name || "",
      phone: worker?.phone || "",
      emergency_contact_name: worker?.emergency_contact_name || "",
      emergency_contact_phone: worker?.emergency_contact_phone || "",
      pay_rate_category_id: worker?.pay_rate_category_id || "",
      tax_file_number: worker?.tax_file_number || "",
      abn: worker?.abn || "",
      super_fund_name: worker?.super_fund_name || "",
      super_fund_number: worker?.super_fund_number || "",
      preferred_days: worker?.preferred_days || [],
      preferred_start_time: worker?.preferred_start_time || "",
      preferred_end_time: worker?.preferred_end_time || "",
      is_active: worker?.is_active ?? true,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateWorkerMutation.mutate(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
  };

  const toggleDay = (day: string) => {
    setFormData((prev: any) => ({
      ...prev,
      preferred_days: prev.preferred_days?.includes(day)
        ? prev.preferred_days.filter((d: string) => d !== day)
        : [...(prev.preferred_days || []), day],
    }));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!worker) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">Worker not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <RemoteCursors users={onlineUsers} />

      <div className="space-y-6" onMouseMove={updateCursor}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {isEditing ? (
                <div className="flex gap-2">
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="text-3xl font-bold h-auto"
                  />
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="text-3xl font-bold h-auto"
                  />
                </div>
              ) : (
                `${worker.first_name} ${worker.last_name}`
              )}
            </h1>
            <p className="text-muted-foreground">{worker.email || "No email set"}</p>
          </div>
          <div className="flex items-center gap-2">
            <PresenceIndicator users={onlineUsers} />
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                Edit Worker
              </Button>
            )}
            <Badge variant={worker.is_active ? "default" : "secondary"}>
              {worker.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        <AuditDrawer
          tableName="profiles"
          recordId={id!}
          recordTitle={`${worker.first_name} ${worker.last_name}`}
        />

        <Tabs defaultValue="details" className="w-full">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="licenses">Licenses</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="history">Activity History</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{worker.email}</span>
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  ) : (
                    worker.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{worker.phone}</span>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Emergency Contact Name</Label>
                        <Input
                          value={formData.emergency_contact_name}
                          onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Emergency Contact Phone</Label>
                        <Input
                          value={formData.emergency_contact_phone}
                          onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {worker.emergency_contact_name && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{worker.emergency_contact_name}</span>
                        </div>
                      )}
                      {worker.emergency_contact_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{worker.emergency_contact_phone}</span>
                        </div>
                      )}
                      {!worker.emergency_contact_name && !worker.emergency_contact_phone && (
                        <p className="text-muted-foreground">No emergency contact set</p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pay Rate & Tax</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Pay Rate Category</Label>
                        <Select
                          value={formData.pay_rate_category_id}
                          onValueChange={(value) => setFormData({ ...formData, pay_rate_category_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select pay rate" />
                          </SelectTrigger>
                          <SelectContent>
                            {payRateCategories.map((category: any) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name} - ${category.hourly_rate}/hr
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Employment Type</Label>
                        <Select
                          value={formData.employment_type || 'full_time'}
                          onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full_time">Full Time</SelectItem>
                            <SelectItem value="part_time">Part Time</SelectItem>
                            <SelectItem value="contractor">Contractor</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Standard Work Hours per Week</Label>
                        <Input
                          type="number"
                          min="0"
                          max="168"
                          step="0.5"
                          value={formData.standard_work_hours || '40'}
                          onChange={(e) => setFormData({ ...formData, standard_work_hours: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">Used for utilization calculations</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Tax File Number</Label>
                        <Input
                          value={formData.tax_file_number}
                          onChange={(e) => setFormData({ ...formData, tax_file_number: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>ABN</Label>
                        <Input
                          value={formData.abn}
                          onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {worker.employment_type && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Employment Type</div>
                            <div className="font-medium capitalize">{worker.employment_type.replace('_', ' ')}</div>
                          </div>
                        </div>
                      )}
                      {worker.standard_work_hours && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Standard Hours/Week</div>
                            <div className="font-medium">{worker.standard_work_hours}h</div>
                          </div>
                        </div>
                      )}
                      {worker.pay_rate_category && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{worker.pay_rate_category.name}</div>
                            <div className="text-sm text-muted-foreground">
                              ${worker.pay_rate_category.hourly_rate}/hr
                            </div>
                          </div>
                        </div>
                      )}
                      {worker.tax_file_number && (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">TFN</div>
                            <div className="font-mono">{worker.tax_file_number}</div>
                          </div>
                        </div>
                      )}
                      {worker.abn && (
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">ABN</div>
                            <div className="font-mono">{worker.abn}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Superannuation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Fund Name</Label>
                        <Input
                          value={formData.super_fund_name}
                          onChange={(e) => setFormData({ ...formData, super_fund_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fund Number</Label>
                        <Input
                          value={formData.super_fund_number}
                          onChange={(e) => setFormData({ ...formData, super_fund_number: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {worker.super_fund_name && (
                        <div>
                          <div className="text-sm text-muted-foreground">Fund Name</div>
                          <div className="font-medium">{worker.super_fund_name}</div>
                        </div>
                      )}
                      {worker.super_fund_number && (
                        <div>
                          <div className="text-sm text-muted-foreground">Fund Number</div>
                          <div className="font-mono">{worker.super_fund_number}</div>
                        </div>
                      )}
                      {!worker.super_fund_name && !worker.super_fund_number && (
                        <p className="text-muted-foreground">No superannuation details set</p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Work Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Preferred Days</Label>
                        <div className="flex flex-wrap gap-2">
                          {DAYS_OF_WEEK.map((day) => (
                            <Badge
                              key={day}
                              variant={formData.preferred_days?.includes(day) ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => toggleDay(day)}
                            >
                              {day}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={formData.preferred_start_time}
                            onChange={(e) => setFormData({ ...formData, preferred_start_time: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Time</Label>
                          <Input
                            type="time"
                            value={formData.preferred_end_time}
                            onChange={(e) => setFormData({ ...formData, preferred_end_time: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label className="text-base">Active Status</Label>
                          <div className="text-sm text-muted-foreground">
                            Inactive workers cannot log in or be assigned to jobs
                          </div>
                        </div>
                        <Switch
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {worker.preferred_days && worker.preferred_days.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                          <div>
                            <div className="text-sm text-muted-foreground">Preferred Days</div>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {worker.preferred_days.map((day: string) => (
                                <Badge key={day} variant="outline">
                                  {day}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {worker.preferred_start_time && worker.preferred_end_time && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Preferred Hours</div>
                            <div>
                              {worker.preferred_start_time} - {worker.preferred_end_time}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="skills">
            <WorkerSkillsTab workerId={id!} />
          </TabsContent>

          <TabsContent value="certificates">
            <WorkerCertificatesTab workerId={id!} />
          </TabsContent>

          <TabsContent value="licenses">
            <WorkerLicensesTab workerId={id!} />
          </TabsContent>

          <TabsContent value="training">
            <WorkerTrainingTab workerId={id!} />
          </TabsContent>

          <TabsContent value="availability">
            <WorkerAvailability workerId={id!} />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <AuditTimeline tableName="profiles" recordId={id!} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
