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
import LinkUserAccountDialog from "@/components/workers/LinkUserAccountDialog";

export default function WorkerDetails() {
  const { id } = useParams<{ id: string }>();
  const { onlineUsers, updateCursorPosition } = usePresence({ page: `worker-${id}` });
  const [linkAccountDialogOpen, setLinkAccountDialogOpen] = useState(false);

  const updateCursor = (e: React.MouseEvent) => {
    updateCursorPosition(e.clientX, e.clientY);
  };

  const { data: worker, isLoading } = useQuery({
    queryKey: ["worker", id],
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(`
          *,
          pay_rate_category:pay_rate_categories(name, hourly_rate)
        `)
        .eq("id", id)
        .single();

      if (profileError) throw profileError;

      const { data: { user } } = await supabase.auth.admin.getUserById(id!);

      return {
        ...profile,
        email: user?.email,
      };
    },
    enabled: !!id,
  });

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
      
      <LinkUserAccountDialog
        open={linkAccountDialogOpen}
        onOpenChange={setLinkAccountDialogOpen}
        workerId={id!}
        workerName={`${worker.first_name} ${worker.last_name}`}
      />

      <div className="space-y-6" onMouseMove={updateCursor}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {worker.first_name} {worker.last_name}
            </h1>
            <p className="text-muted-foreground">{worker.email || "No email set"}</p>
          </div>
          <div className="flex items-center gap-2">
            <PresenceIndicator users={onlineUsers} />
            {!worker.email && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setLinkAccountDialogOpen(true)}
              >
                Create User Account
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
                  {worker.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{worker.phone}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pay Rate & Tax</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Superannuation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Work Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
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
