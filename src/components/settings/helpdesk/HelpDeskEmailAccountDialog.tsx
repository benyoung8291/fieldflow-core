import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Loader2 } from "lucide-react";

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
    pipeline_id: "",
    is_active: true,
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [oauthData, setOauthData] = useState<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    accountId: string;
  } | null>(null);

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

  // Handle OAuth callback message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.accessToken && event.data.refreshToken) {
        setOauthData({
          accessToken: event.data.accessToken,
          refreshToken: event.data.refreshToken,
          expiresIn: event.data.expiresIn,
          accountId: event.data.accountId,
        });
        setFormData(prev => ({
          ...prev,
          email_address: event.data.email,
          display_name: event.data.email,
        }));
        setIsAuthenticating(false);
        toast({
          title: "Microsoft account connected successfully!",
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast]);

  // Populate form when account is provided
  useEffect(() => {
    if (account) {
      setFormData({
        email_address: account.email_address || "",
        display_name: account.display_name || "",
        pipeline_id: account.pipeline_id || "",
        is_active: account.is_active ?? true,
      });
    } else {
      setFormData({
        email_address: "",
        display_name: "",
        pipeline_id: pipelines?.[0]?.id || "",
        is_active: true,
      });
      setOauthData(null);
    }
  }, [account, open, pipelines]);

  // Microsoft OAuth handler
  const handleMicrosoftAuth = async () => {
    try {
      setIsAuthenticating(true);
      const { data, error } = await supabase.functions.invoke("microsoft-oauth-authorize");
      
      if (error) throw error;
      
      // Open OAuth popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        data.authUrl,
        "Microsoft Sign In",
        `width=${width},height=${height},left=${left},top=${top}`
      );
    } catch (error) {
      console.error("Error starting Microsoft auth:", error);
      toast({
        title: "Failed to start Microsoft authentication",
        variant: "destructive",
      });
      setIsAuthenticating(false);
    }
  };

  // Mutation to save the email account
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

      if (!oauthData && !account) {
        throw new Error("Please connect your Microsoft account first");
      }

      const expiresAt = oauthData 
        ? new Date(Date.now() + oauthData.expiresIn * 1000).toISOString()
        : undefined;

      const accountData: any = {
        tenant_id: profile.tenant_id,
        email_address: formData.email_address,
        display_name: formData.display_name,
        provider: "microsoft",
        pipeline_id: formData.pipeline_id || null,
        is_active: formData.is_active,
      };

      if (oauthData) {
        accountData.microsoft_access_token = oauthData.accessToken;
        accountData.microsoft_refresh_token = oauthData.refreshToken;
        accountData.microsoft_token_expires_at = expiresAt;
        accountData.microsoft_account_id = oauthData.accountId;
      }

      if (account) {
        // Update existing account
        const { error } = await supabase
          .from("helpdesk_email_accounts" as any)
          .update(accountData)
          .eq("id", account.id);

        if (error) throw error;
      } else {
        // Create new account
        const { error } = await supabase
          .from("helpdesk_email_accounts" as any)
          .insert(accountData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-email-accounts-settings"] });
      toast({
        title: account ? "Email account updated successfully" : "Email account connected successfully",
        description: "Your Microsoft email is now connected",
      });
      onOpenChange(false);
      setOauthData(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save email account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {account ? "Edit Email Account" : "Connect Email Account"}
          </DialogTitle>
          <DialogDescription>
            Connect your Microsoft email account for the help desk system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!account && !oauthData && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <p className="text-center text-muted-foreground">
                Sign in with your Microsoft account to get started
              </p>
              <Button
                onClick={handleMicrosoftAuth}
                disabled={isAuthenticating}
                size="lg"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Sign in with Microsoft"
                )}
              </Button>
            </div>
          )}

          {(account || oauthData) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email_address">Email Address</Label>
                <Input
                  id="email_address"
                  type="email"
                  value={formData.email_address}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  placeholder="Support Team"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pipeline_id">Route to Pipeline *</Label>
                <Select
                  value={formData.pipeline_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, pipeline_id: value })
                  }
                >
                  <SelectTrigger id="pipeline_id">
                    <SelectValue placeholder="Select a pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines?.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Emails received by this account will be automatically routed to the selected pipeline
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable this email account
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {(account || oauthData) && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!formData.email_address || !formData.display_name || !formData.pipeline_id || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : account ? "Update Account" : "Connect Account"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
