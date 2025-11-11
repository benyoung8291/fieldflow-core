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
  const [isFetchingMailboxes, setIsFetchingMailboxes] = useState(false);
  const [oauthData, setOauthData] = useState<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    accountId: string;
  } | null>(null);
  const [availableMailboxes, setAvailableMailboxes] = useState<Array<{
    email: string;
    displayName: string;
    type: string;
  }>>([]);

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

  // Fetch available mailboxes after OAuth
  const fetchMailboxes = useCallback(async (accessToken: string, userEmail: string, userName: string) => {
    setIsFetchingMailboxes(true);
    try {
      // Just use the authenticated user's mailbox (don't fetch settings which requires extra permissions)
      const mailboxes: Array<{ email: string; displayName: string; type: string }> = [
        { email: userEmail, displayName: `${userName} (Personal)`, type: "personal" }
      ];

      setAvailableMailboxes(mailboxes);
      
      // Auto-select the first mailbox
      setFormData(prev => ({
        ...prev,
        email_address: userEmail,
        name: userName,
      }));
    } catch (error) {
      console.error("Error setting up mailbox:", error);
      toast({
        title: "Could not set up mailbox",
        description: "Using authenticated account as default",
        variant: "destructive",
      });
      
      // Fallback to user email
      setAvailableMailboxes([
        { email: userEmail, displayName: `${userName} (Personal)`, type: "personal" }
      ]);
      setFormData(prev => ({
        ...prev,
        email_address: userEmail,
        name: userName,
      }));
    } finally {
      setIsFetchingMailboxes(false);
    }
  }, [toast]);

  // Sync prop OAuth data to local state when it changes
  useEffect(() => {
    if (propOauthData && !oauthData) {
      console.log("📥 Received OAuth data via props, processing...");
      setOauthData(propOauthData);
      setIsAuthenticating(false);
      
      // Fetch mailboxes
      fetchMailboxes(
        propOauthData.accessToken,
        propOauthData.email,
        propOauthData.email
      ).catch((error) => {
        console.error("Error fetching mailboxes:", error);
        // Set default values even if fetch fails
        setAvailableMailboxes([
          { email: propOauthData.email, displayName: `${propOauthData.email} (Personal)`, type: "personal" }
        ]);
        setFormData(prev => ({
          ...prev,
          email_address: propOauthData.email,
          name: propOauthData.email,
        }));
        setIsFetchingMailboxes(false);
      });
    }
  }, [propOauthData, oauthData, fetchMailboxes]);

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
    console.log("🎯 Starting Microsoft OAuth with popup + polling");
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
            // Poll database for completion
            // @ts-ignore - Bypass complex type inference
            const result = await supabase
              .from("oauth_temp_tokens")
              .select("*")
              .eq("session_key", sessionKey)
              .maybeSingle();
            
            const tokenData = result.data;
            const fetchError = result.error;

            if (tokenData && !fetchError) {
              clearInterval(checkInterval);
              popup.close();
              
              console.log("✅ OAuth tokens retrieved from polling");

              // Delete the temp tokens
              await supabase
                .from("oauth_temp_tokens")
                .delete()
                .eq("session_key", sessionKey);

              const oauthData = {
                email: tokenData.email,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresIn: tokenData.expires_in,
                accountId: tokenData.account_id,
              };

              // Fetch mailboxes
              fetchMailboxes(
                oauthData.accessToken,
                oauthData.email,
                oauthData.email
              ).catch((error) => {
                console.error("Error fetching mailboxes:", error);
                setAvailableMailboxes([
                  { email: oauthData.email, displayName: `${oauthData.email} (Personal)`, type: "personal" }
                ]);
                setFormData(prev => ({
                  ...prev,
                  email_address: oauthData.email,
                  name: oauthData.email,
                }));
                setIsFetchingMailboxes(false);
              });

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
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
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
                    Sign in with your Microsoft account to get started
                  </p>
                  <Button
                    onClick={handleMicrosoftAuth}
                    size="lg"
                  >
                    Sign in with Microsoft
                  </Button>
                </>
              )}
            </div>
          )}

          {(account || oauthData) && (
            <>
              {isFetchingMailboxes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Fetching available mailboxes...</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email_select">Select Email Account</Label>
                    <Select
                      value={formData.email_address}
                      onValueChange={(value) => {
                        const selected = availableMailboxes.find(m => m.email === value);
                        setFormData({ 
                          ...formData, 
                          email_address: value,
                          name: selected?.displayName || value
                        });
                      }}
                      disabled={account !== undefined}
                    >
                      <SelectTrigger id="email_select">
                        <SelectValue placeholder="Select email account" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMailboxes.map((mailbox) => (
                          <SelectItem key={mailbox.email} value={mailbox.email}>
                            {mailbox.displayName} - {mailbox.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Choose which email account to use for the help desk
                    </p>
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
                </>
              )}

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
