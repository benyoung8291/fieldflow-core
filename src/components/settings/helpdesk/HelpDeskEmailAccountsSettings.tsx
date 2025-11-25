import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Mail, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { HelpDeskEmailAccountDialog } from "./HelpDeskEmailAccountDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

export function HelpDeskEmailAccountsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<any>(null);
  const [testingAccount, setTestingAccount] = useState<string | null>(null);
  const [syncingAccount, setSyncingAccount] = useState<string | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["helpdesk-email-accounts-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_email_accounts" as any)
        .select(`
          *,
          pipeline:helpdesk_pipelines(id, name, color)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("helpdesk_email_accounts" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helpdesk-email-accounts-settings"] });
      toast({ 
        title: "Email account deleted",
        description: "Email account removed successfully",
      });
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete email account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testEmailConnection = async (accountId: string) => {
    setTestingAccount(accountId);
    try {
      const { data, error } = await supabase.functions.invoke(
        "microsoft-test-email",
        {
          body: { email_account_id: accountId },
        }
      );

      // Check for edge function invocation errors
      if (error) {
        throw new Error(error.message || "Failed to send test email");
      }

      // Check for application-level errors in the response
      if (data && !data.success) {
        throw new Error(data.error || "Failed to send test email");
      }

      toast({
        title: "Test email sent",
        description: `Check your inbox at ${data.sent_to}`,
      });

      queryClient.invalidateQueries({ queryKey: ["helpdesk-email-accounts-settings"] });
    } catch (error: any) {
      console.error("Test email error:", error);
      
      toast({
        title: "Failed to send test email",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setTestingAccount(null);
    }
  };

  const syncEmails = async (accountId: string) => {
    setSyncingAccount(accountId);
    try {
      toast({ 
        title: "Syncing emails...", 
        description: "Fetching new messages from your mailbox" 
      });
      
      const { data, error } = await supabase.functions.invoke(
        "microsoft-sync-emails",
        {
          body: { emailAccountId: accountId },
        }
      );

      // Check for edge function errors
      if (error) {
        throw new Error(error.message || "Failed to sync emails");
      }

      // Check for application-level errors in the response
      if (data && !data.success && data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Email sync complete",
        description: `Synced ${data.syncedCount || 0} new tickets from ${data.totalMessages || 0} messages`,
      });

      queryClient.invalidateQueries({ queryKey: ["helpdesk-email-accounts-settings"] });
      queryClient.invalidateQueries({ queryKey: ["helpdesk-tickets"] });
    } catch (error: any) {
      console.error("Email sync error:", error);
      toast({
        title: "Failed to sync emails",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSyncingAccount(null);
    }
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const handleDelete = (account: any) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingAccount(null);
  };

  const getProviderIcon = (provider: string) => {
    return <Mail className="h-5 w-5" />;
  };

  const getStatusBadge = (account: any) => {
    if (account.sync_error) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    }
    if (!account.is_active) {
      return (
        <Badge variant="secondary" className="text-xs">
          Inactive
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs border-green-200 text-green-700 dark:border-green-800 dark:text-green-400">
        <CheckCircle className="h-3 w-3 mr-1" />
        Connected
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Email Accounts</h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Connect email accounts to automatically create tickets from incoming emails and send replies to customers
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
          Loading email accounts...
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="group relative flex items-start gap-4 p-4 border rounded-lg bg-card hover:border-primary/50 transition-all"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {getProviderIcon(account.provider)}
              </div>
              
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {account.display_name || account.email_address}
                      </span>
                      {getStatusBadge(account)}
                    </div>
                    <p className="text-sm text-muted-foreground">{account.email_address}</p>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(account)}
                      title="Edit account"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => syncEmails(account.id)}
                      disabled={syncingAccount === account.id}
                      title="Sync emails"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${syncingAccount === account.id ? 'animate-spin' : ''}`} />
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => testEmailConnection(account.id)}
                      disabled={testingAccount === account.id}
                      title="Send test email"
                    >
                      {testingAccount === account.id ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-1" />
                      )}
                      Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(account)}
                      title="Delete account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {account.pipeline && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Routes to:</span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: account.pipeline.color }}
                      />
                      <span className="font-medium">{account.pipeline.name}</span>
                    </div>
                  </div>
                )}

                {account.sync_error && (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{account.sync_error}</p>
                  </div>
                )}

                {account.last_sync_at && !account.sync_error && (
                  <p className="text-xs text-muted-foreground">
                    Last synced {formatDistanceToNow(new Date(account.last_sync_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium mb-2">No email accounts configured</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Connect your first email account to start receiving and managing support tickets
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Connect Email Account
          </Button>
        </div>
      )}

      <HelpDeskEmailAccountDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        account={editingAccount}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{accountToDelete?.email_address}"? 
              <br /><br />
              <strong>This will:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Stop automatic ticket creation from new emails</li>
                <li>Prevent sending replies from this account</li>
                <li>Not affect existing tickets</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(accountToDelete?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
