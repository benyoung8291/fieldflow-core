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
  const fetchMailboxes = async (accessToken: string, userEmail: string, userName: string) => {
    setIsFetchingMailboxes(true);
    try {
      // Get user's mailbox settings
      const settingsResponse = await fetch("https://graph.microsoft.com/v1.0/me/mailboxSettings", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      const mailboxes: Array<{ email: string; displayName: string; type: string }> = [
        { email: userEmail, displayName: `${userName} (Personal)`, type: "personal" }
      ];

      // Try to fetch shared mailboxes the user has access to
      try {
        const sharedResponse = await fetch(
          "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/childFolders?$select=displayName",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (sharedResponse.ok) {
          const sharedData = await sharedResponse.json();
          // Note: This is a simplified approach. In production, you'd want to check
          // for actual shared mailboxes via the /users endpoint if the user has permissions
        }
      } catch (err) {
        console.log("Could not fetch shared mailboxes:", err);
      }

      // Try to get delegated mailboxes
      try {
        const delegateResponse = await fetch(
          "https://graph.microsoft.com/v1.0/me/mailFolders",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        if (delegateResponse.ok) {
          // Additional logic to detect shared/delegated mailboxes could go here
        }
      } catch (err) {
        console.log("Could not fetch delegate access:", err);
      }

      setAvailableMailboxes(mailboxes);
      
      // Auto-select the first mailbox
      if (mailboxes.length > 0) {
        setFormData(prev => ({
          ...prev,
          email_address: mailboxes[0].email,
          display_name: mailboxes[0].displayName,
        }));
      }
    } catch (error) {
      console.error("Error fetching mailboxes:", error);
      toast({
        title: "Could not fetch mailboxes",
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
        display_name: userName,
      }));
    } finally {
      setIsFetchingMailboxes(false);
    }
  };

  // Handle OAuth callback message - set up BEFORE opening the dialog
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      console.log("=== Message Event Received ===");
      console.log("Event origin:", event.origin);
      console.log("Event data:", event.data);
      console.log("Event source:", event.source);
      
      // Check if this is our OAuth callback message
      if (event.data && typeof event.data === 'object') {
        const { email, accessToken, refreshToken, expiresIn, accountId } = event.data;
        
        if (accessToken && refreshToken && email) {
          console.log("✅ Valid OAuth callback data received!");
          console.log("Email:", email);
          console.log("Has access token:", !!accessToken);
          console.log("Has refresh token:", !!refreshToken);
          console.log("Expires in:", expiresIn);
          console.log("Account ID:", accountId);
          
          const oauthInfo = {
            accessToken,
            refreshToken,
            expiresIn,
            accountId,
          };
          
          setOauthData(oauthInfo);
          setIsAuthenticating(false);
          
          toast({
            title: "Microsoft account connected!",
            description: "Fetching available mailboxes...",
          });

          // Fetch user profile and available mailboxes
          try {
            await fetchMailboxes(accessToken, email, email);
          } catch (error) {
            console.error("Error fetching mailboxes:", error);
            toast({
              title: "Could not fetch mailboxes",
              description: "Using authenticated account as default",
              variant: "destructive",
            });
            
            // Set default values even if fetch fails
            setAvailableMailboxes([
              { email, displayName: `${email} (Personal)`, type: "personal" }
            ]);
            setFormData(prev => ({
              ...prev,
              email_address: email,
              display_name: email,
            }));
          }
        } else {
          console.log("❌ Message received but missing required OAuth fields");
        }
      } else {
        console.log("ℹ️ Message received but not OAuth data:", typeof event.data);
      }
    };

    // Add listener as soon as component mounts
    console.log("🎧 Setting up message listener for OAuth callback");
    window.addEventListener("message", handleMessage);
    
    return () => {
      console.log("🔇 Removing message listener");
      window.removeEventListener("message", handleMessage);
    };
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
      
      console.log("Starting Microsoft OAuth...");
      
      const { data, error } = await supabase.functions.invoke("microsoft-oauth-authorize");
      
      if (error) {
        console.error("Error from oauth-authorize:", error);
        throw error;
      }
      
      console.log("Got auth URL, opening popup...");
      
      // Open OAuth popup
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        "Microsoft Sign In",
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      if (!popup) {
        throw new Error("Popup was blocked. Please allow popups for this site.");
      }
      
      console.log("Popup opened successfully");
    } catch (error) {
      console.error("Error starting Microsoft auth:", error);
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
              {isAuthenticating ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <div className="text-center space-y-2">
                    <p className="font-medium">Waiting for authentication...</p>
                    <p className="text-sm text-muted-foreground">
                      Please complete the sign-in process in the popup window
                    </p>
                    <p className="text-xs text-muted-foreground">
                      If the popup was blocked, please allow popups and try again
                    </p>
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
                          display_name: selected?.displayName || value
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
