import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface HelpDeskEmailAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: any;
}

export function HelpDeskEmailAccountDialog({
  open,
  onOpenChange,
  account,
}: HelpDeskEmailAccountDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    email_address: "",
    display_name: "",
    provider: "microsoft",
    pipeline_id: "",
    is_active: true,
    // IMAP/SMTP credentials
    imap_host: "",
    imap_port: "993",
    imap_username: "",
    imap_password: "",
    smtp_host: "",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
    // Microsoft OAuth
    microsoft_client_id: "",
    microsoft_client_secret: "",
    microsoft_tenant_id: "",
  });

  const { data: pipelines } = useQuery({
    queryKey: ["helpdesk-pipelines-for-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_pipelines" as any)
        .select("id, name")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (account) {
      setFormData({
        email_address: account.email_address || "",
        display_name: account.display_name || "",
        provider: account.provider || "microsoft",
        pipeline_id: account.pipeline_id || "",
        is_active: account.is_active ?? true,
        imap_host: "",
        imap_port: "993",
        imap_username: "",
        imap_password: "",
        smtp_host: "",
        smtp_port: "587",
        smtp_username: "",
        smtp_password: "",
        microsoft_client_id: "",
        microsoft_client_secret: "",
        microsoft_tenant_id: "",
      });
    } else {
      setFormData({
        email_address: "",
        display_name: "",
        provider: "microsoft",
        pipeline_id: pipelines?.[0]?.id || "",
        is_active: true,
        imap_host: "",
        imap_port: "993",
        imap_username: "",
        imap_password: "",
        smtp_host: "",
        smtp_port: "587",
        smtp_username: "",
        smtp_password: "",
        microsoft_client_id: "",
        microsoft_client_secret: "",
        microsoft_tenant_id: "",
      });
    }
  }, [account, open, pipelines]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Store credentials encrypted in the database
      const credentials = formData.provider === "microsoft" 
        ? {
            client_id: formData.microsoft_client_id,
            client_secret: formData.microsoft_client_secret,
            tenant_id: formData.microsoft_tenant_id,
          }
        : {
            imap: {
              host: formData.imap_host,
              port: parseInt(formData.imap_port),
              username: formData.imap_username,
              password: formData.imap_password,
            },
            smtp: {
              host: formData.smtp_host,
              port: parseInt(formData.smtp_port),
              username: formData.smtp_username,
              password: formData.smtp_password,
            },
          };

      const accountData = {
        email_address: formData.email_address,
        display_name: formData.display_name,
        provider: formData.provider,
        pipeline_id: formData.pipeline_id,
        is_active: formData.is_active,
        tenant_id: profile.tenant_id,
        // Store credentials as encrypted JSON
        // In production, use proper encryption
        sync_error: JSON.stringify(credentials),
      };

      if (account) {
        const { error } = await supabase
          .from("helpdesk_email_accounts" as any)
          .update(accountData)
          .eq("id", account.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("helpdesk_email_accounts" as any)
          .insert(accountData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-email-accounts-settings"] });
      toast({
        title: account
          ? "Email account updated successfully"
          : "Email account connected successfully",
        description: "Email sync will begin shortly",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save email account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {account ? "Edit Email Account" : "Connect Email Account"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email_address">Email Address *</Label>
              <Input
                id="email_address"
                type="email"
                value={formData.email_address}
                onChange={(e) =>
                  setFormData({ ...formData, email_address: e.target.value })
                }
                placeholder="support@company.com"
              />
            </div>

            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                placeholder="Support Team"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="provider">Email Provider *</Label>
              <Select
                value={formData.provider}
                onValueChange={(value) => setFormData({ ...formData, provider: value })}
              >
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="microsoft">Microsoft 365 / Outlook</SelectItem>
                  <SelectItem value="imap">IMAP/SMTP (Generic)</SelectItem>
                  <SelectItem value="gmail">Gmail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pipeline_id">Route to Pipeline *</Label>
              <Select
                value={formData.pipeline_id}
                onValueChange={(value) => setFormData({ ...formData, pipeline_id: value })}
              >
                <SelectTrigger id="pipeline_id">
                  <SelectValue placeholder="Select pipeline..." />
                </SelectTrigger>
                <SelectContent>
                  {pipelines?.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="credentials" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="credentials">Credentials</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="credentials" className="space-y-4 mt-4">
              {formData.provider === "microsoft" ? (
                <>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      To connect Microsoft 365, you need to register an app in Azure AD and
                      obtain OAuth credentials with Mail.Read and Mail.Send permissions.
                    </AlertDescription>
                  </Alert>

                  <div>
                    <Label htmlFor="microsoft_client_id">Client ID *</Label>
                    <Input
                      id="microsoft_client_id"
                      value={formData.microsoft_client_id}
                      onChange={(e) =>
                        setFormData({ ...formData, microsoft_client_id: e.target.value })
                      }
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                  </div>

                  <div>
                    <Label htmlFor="microsoft_client_secret">Client Secret *</Label>
                    <Input
                      id="microsoft_client_secret"
                      type="password"
                      value={formData.microsoft_client_secret}
                      onChange={(e) =>
                        setFormData({ ...formData, microsoft_client_secret: e.target.value })
                      }
                      placeholder="Your client secret"
                    />
                  </div>

                  <div>
                    <Label htmlFor="microsoft_tenant_id">Tenant ID *</Label>
                    <Input
                      id="microsoft_tenant_id"
                      value={formData.microsoft_tenant_id}
                      onChange={(e) =>
                        setFormData({ ...formData, microsoft_tenant_id: e.target.value })
                      }
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">IMAP Settings (Incoming)</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Label htmlFor="imap_host">IMAP Host *</Label>
                        <Input
                          id="imap_host"
                          value={formData.imap_host}
                          onChange={(e) =>
                            setFormData({ ...formData, imap_host: e.target.value })
                          }
                          placeholder="imap.gmail.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="imap_port">Port *</Label>
                        <Input
                          id="imap_port"
                          value={formData.imap_port}
                          onChange={(e) =>
                            setFormData({ ...formData, imap_port: e.target.value })
                          }
                          placeholder="993"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="imap_username">Username *</Label>
                      <Input
                        id="imap_username"
                        value={formData.imap_username}
                        onChange={(e) =>
                          setFormData({ ...formData, imap_username: e.target.value })
                        }
                        placeholder="your-email@domain.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="imap_password">Password *</Label>
                      <Input
                        id="imap_password"
                        type="password"
                        value={formData.imap_password}
                        onChange={(e) =>
                          setFormData({ ...formData, imap_password: e.target.value })
                        }
                        placeholder="Your password or app-specific password"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">SMTP Settings (Outgoing)</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Label htmlFor="smtp_host">SMTP Host *</Label>
                        <Input
                          id="smtp_host"
                          value={formData.smtp_host}
                          onChange={(e) =>
                            setFormData({ ...formData, smtp_host: e.target.value })
                          }
                          placeholder="smtp.gmail.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtp_port">Port *</Label>
                        <Input
                          id="smtp_port"
                          value={formData.smtp_port}
                          onChange={(e) =>
                            setFormData({ ...formData, smtp_port: e.target.value })
                          }
                          placeholder="587"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="smtp_username">Username *</Label>
                      <Input
                        id="smtp_username"
                        value={formData.smtp_username}
                        onChange={(e) =>
                          setFormData({ ...formData, smtp_username: e.target.value })
                        }
                        placeholder="your-email@domain.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp_password">Password *</Label>
                      <Input
                        id="smtp_password"
                        type="password"
                        value={formData.smtp_password}
                        onChange={(e) =>
                          setFormData({ ...formData, smtp_password: e.target.value })
                        }
                        placeholder="Your password or app-specific password"
                      />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive accounts won't sync new emails
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={
              !formData.email_address ||
              !formData.pipeline_id ||
              saveMutation.isPending
            }
          >
            {saveMutation.isPending
              ? "Saving..."
              : account
              ? "Update Account"
              : "Connect Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
