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
    provider: "resend",
    pipeline_id: "",
    is_active: true,
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
        provider: account.provider || "resend",
        pipeline_id: account.pipeline_id || "",
        is_active: account.is_active ?? true,
      });
    } else {
      setFormData({
        email_address: "",
        display_name: "",
        provider: "resend",
        pipeline_id: pipelines?.[0]?.id || "",
        is_active: true,
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

      const accountData = {
        email_address: formData.email_address,
        display_name: formData.display_name,
        provider: formData.provider,
        pipeline_id: formData.pipeline_id,
        is_active: formData.is_active,
        tenant_id: profile.tenant_id,
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
        description: "Email sync is now configured",
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

          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="setup">Setup Instructions</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4 mt-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm space-y-2">
                  <div>
                    <strong>Email Integration via Resend</strong>
                  </div>
                  <div>This help desk uses Resend for both sending and receiving emails.</div>
                </AlertDescription>
              </Alert>

              <div className="p-3 bg-muted rounded-md space-y-2">
                <Label className="text-xs font-medium">Webhook URL (Copy this)</Label>
                <code className="block text-xs p-2 bg-background rounded border break-all select-all">
                  https://puffpjmmuoaecxygrkcm.supabase.co/functions/v1/helpdesk-receive-email
                </code>
              </div>

              <div className="space-y-3">
                <div>
                  <strong className="text-sm">Step 1: Create Resend Account</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sign up at{" "}
                    <a
                      href="https://resend.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      resend.com
                    </a>
                  </p>
                </div>

                <div>
                  <strong className="text-sm">Step 2: Verify Your Domain</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    In Resend dashboard, go to Domains → Add Domain → Follow DNS verification steps
                  </p>
                </div>

                <div>
                  <strong className="text-sm">Step 3: Configure Inbound Email</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    • In Resend, go to Domains → Your Domain → Inbound<br />
                    • Add your email address (e.g., support@yourdomain.com)<br />
                    • Set Forward To URL to the webhook URL above<br />
                    • Save the configuration
                  </p>
                </div>

                <div>
                  <strong className="text-sm">Step 4: Test the Connection</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    After saving this account, use the "Test" button to verify email sending works
                  </p>
                </div>
              </div>
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
