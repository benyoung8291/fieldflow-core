import { useState, useEffect, useRef, useCallback } from "react";
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
  oauthData?: {
    email: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    accountId: string;
  } | null;
}

export function HelpDeskEmailAccountDialog({
  open,
  onOpenChange,
  account,
  oauthData: propOauthData,
}: HelpDeskEmailAccountDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    email_address: "",
    name: "",
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

  // Store refs (no longer needed but kept for now)
  const popupRef = useRef<Window | null>(null);
  const checkIntervalRef = useRef<number | null>(null);

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

  // Verify access to the specified mailbox after OAuth
  const verifyMailboxAccess = useCallback(async (accessToken: string, targetEmail: string) => {
    try {
      console.log(`🔍 Verifying access to mailbox: ${targetEmail}`);
      
      // Try to access the mailbox's inbox to verify permissions
      const testAccessResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${targetEmail}/mailFolders/inbox`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!testAccessResponse.ok) {
        throw new Error(`Cannot access mailbox ${targetEmail}. You may not have the required permissions.`);
      }

      console.log(`✅ Successfully verified access to: ${targetEmail}`);
      return true;
    } catch (error) {
      console.error("Error verifying mailbox access:", error);
      throw error;
    }
  }, []);

  // Sync prop OAuth data to local state when it changes
  useEffect(() => {
    if (propOauthData && !oauthData) {
      console.log("📥 Received OAuth data via props, verifying mailbox access...");
      
      // Verify access to the target mailbox
      const targetEmail = formData.email_address;
      if (targetEmail) {
        verifyMailboxAccess(propOauthData.accessToken, targetEmail)
          .then(() => {
            console.log("✅ Mailbox access verified, ready to save");
            setOauthData(propOauthData);
            setIsAuthenticating(false);
            toast({
              title: "Authentication successful",
              description: `Connected to ${targetEmail}`,
            });
          })
          .catch((error) => {
            console.error("❌ Mailbox access verification failed:", error);
            setIsAuthenticating(false);
            toast({
              title: "Cannot access mailbox",
              description: error.message || "You may not have the required permissions to access this mailbox.",
              variant: "destructive",
            });
          });
      }
    }
  }, [propOauthData, oauthData, formData.email_address, verifyMailboxAccess, toast]);

  // Populate form when account is provided
  useEffect(() => {
    if (account) {
      setFormData({
        email_address: account.email_address || "",
        name: account.name || "",
        pipeline_id: account.pipeline_id || "",
        is_active: account.is_active ?? true,
      });
    } else {
      setFormData({
        email_address: "",
        name: "",
        pipeline_id: pipelines?.[0]?.id || "",
        is_active: true,
      });
      setOauthData(null);
    }
  }, [account, open, pipelines]);

  // Microsoft OAuth handler - popup approach with polling
  const handleMicrosoftAuth = async () => {
    // Validate email address is entered
    if (!formData.email_address) {
      toast({
        title: "Email address required",
        description: "Please enter the email address you want to connect first",
        variant: "destructive",
      });
      return;
    }

    console.log("🎯 Starting Microsoft OAuth for mailbox:", formData.email_address);
    console.log("🎯 Current localStorage oauth_in_progress:", localStorage.getItem('oauth_in_progress'));
    
    try {
      // Set flag to prevent app from reacting to auth changes during OAuth
      localStorage.setItem('oauth_in_progress', 'true');
      const startTime = Date.now();
      console.log("🎯 Set oauth_in_progress flag to true in localStorage at", new Date().toISOString());
      
      // Safety timeout: clear flag after 5 minutes no matter what
      const safetyTimeout = setTimeout(() => {
        console.warn("⚠️ OAuth safety timeout reached - clearing flag");
        localStorage.removeItem('oauth_in_progress');
        localStorage.removeItem('oauth_session_key');
      }, 5 * 60 * 1000); // 5 minutes
      
      setIsAuthenticating(true);
      
      // Generate a unique session identifier
      const sessionKey = `oauth_session_${crypto.randomUUID()}`;
      sessionStorage.setItem('oauth_session_key', sessionKey);
      
      const { data, error } = await supabase.functions.invoke("microsoft-oauth-authorize", {
        body: { sessionKey }
      });
      
      if (error) throw error;
      if (!data?.authUrl) throw new Error("No authorization URL received");
      
      console.log("Opening OAuth popup...");
      
      // Open popup window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        "MicrosoftOAuth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );
      
      if (!popup) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }
      
      // Poll database for OAuth completion
      const pollForCompletion = async () => {
        const maxAttempts = 60; // 2 minutes max (60 * 2 seconds)
        let attempts = 0;
        
        const checkInterval = setInterval(async () => {
          attempts++;
          
          // Check if popup was closed
          if (popup.closed) {
            clearInterval(checkInterval);
            clearTimeout(safetyTimeout);
            localStorage.removeItem('oauth_in_progress');
            localStorage.removeItem('oauth_session_key');
            console.log("🚪 Popup closed, flags cleared");
            setIsAuthenticating(false);
            toast({
              title: "Authentication cancelled",
              description: "The sign-in window was closed",
            });
            return;
          }
          
          // Check if max attempts reached
          if (attempts > maxAttempts) {
            clearInterval(checkInterval);
            clearTimeout(safetyTimeout);
            popup.close();
            localStorage.removeItem('oauth_in_progress');
            localStorage.removeItem('oauth_session_key');
            console.log("⏱️ OAuth timeout, flags cleared");
            setIsAuthenticating(false);
            toast({
              title: "Authentication timeout",
              description: "Please try again",
              variant: "destructive",
            });
            return;
          }
          
          try {
            // Poll database for completion using secure RPC function
            // @ts-ignore - Bypass complex type inference
            const result = await supabase.rpc('get_oauth_token_by_key', { 
              p_session_key: sessionKey 
            });
            
            // RPC returns an array, get the first result
            const tokenData = result.data?.[0];
            const fetchError = result.error;

            if (tokenData && !fetchError) {
              clearInterval(checkInterval);
              popup.close();
              
              console.log("✅ OAuth tokens retrieved from polling");

              // Note: Tokens are automatically cleaned up by the cleanup-oauth-tokens edge function
              // No need to delete manually (user doesn't have permission)

              const oauthData = {
                email: tokenData.email,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresIn: tokenData.expires_in,
                accountId: tokenData.account_id,
              };

              setOauthData(oauthData);
              setIsAuthenticating(false);
              
              // Clear OAuth in progress flag
              console.log("✅ OAuth complete, clearing flags from localStorage");
              clearTimeout(safetyTimeout);
              localStorage.removeItem('oauth_in_progress');
              localStorage.removeItem('oauth_session_key');
              console.log("✅ Flags cleared at", new Date().toISOString(), "oauth_in_progress:", localStorage.getItem('oauth_in_progress'));
              console.log("✅ Total OAuth duration:", (Date.now() - startTime) / 1000, "seconds");

              toast({
                title: "Microsoft account connected!",
                description: `Authenticated as ${oauthData.email}`,
              });
            }
          } catch (error) {
            console.error("Error polling for OAuth completion:", error);
          }
        }, 2000); // Poll every 2 seconds
      };
      
      pollForCompletion();
      
    } catch (error) {
      console.error("❌ Microsoft auth error:", error);
      localStorage.removeItem('oauth_in_progress');
      localStorage.removeItem('oauth_session_key');
      console.log("❌ Error occurred, flags cleared");
      toast({
        title: "Failed to start Microsoft authentication",
        description: error instanceof Error ? error.message : "Unknown error",
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
        name: formData.name,
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
            <>
              <div className="space-y-2 mb-4">
                <Label htmlFor="email_address">Email Address *</Label>
                <Input
                  id="email_address"
                  type="email"
                  placeholder="support@company.com or shared@company.com"
                  value={formData.email_address}
                  onChange={(e) =>
                    setFormData({ ...formData, email_address: e.target.value })
                  }
                  disabled={isAuthenticating}
                />
                <p className="text-sm text-muted-foreground">
                  Enter your personal email or a shared mailbox email that you have access to
                </p>
              </div>

              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                {isAuthenticating ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <div className="text-center space-y-2">
                      <p className="font-medium">Waiting for authentication...</p>
                      <p className="text-sm text-muted-foreground">
                        Complete the sign-in process to continue
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsAuthenticating(false);
                          localStorage.removeItem('oauth_in_progress');
                          localStorage.removeItem('oauth_session_key');
                          toast({
                            title: "Authentication cancelled",
                            description: "You can try again when ready",
                          });
                        }}
                        className="mt-2"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-center text-muted-foreground">
                      Sign in with your Microsoft account to authorize access
                    </p>
                    <Button
                      onClick={handleMicrosoftAuth}
                      size="lg"
                      disabled={!formData.email_address}
                    >
                      Sign in with Microsoft
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {(account || oauthData) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email_display">Email Address</Label>
                <Input
                  id="email_display"
                  value={formData.email_address}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="Support Team"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
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
              disabled={!formData.email_address || !formData.name || !formData.pipeline_id || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : account ? "Update Account" : "Connect Account"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
