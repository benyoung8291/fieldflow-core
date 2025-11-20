import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download, Upload, RefreshCw, CheckCircle, XCircle, Loader2, AlertCircle, Link as LinkIcon, Unlink } from "lucide-react";
import { ImportAccountsDialog } from "./ImportAccountsDialog";

interface ExternalAccount {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  abn?: string;
  type: 'customer' | 'supplier';
}

interface MappedAccount extends ExternalAccount {
  appAccountId?: string;
  appAccountName?: string;
  syncStatus: 'unmapped' | 'mapped' | 'synced';
}

export default function AccountSyncTab() {
  const [accountType, setAccountType] = useState<'customers' | 'suppliers'>('customers');
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedAppAccount, setSelectedAppAccount] = useState<string>("");
  const [selectedXeroAccount, setSelectedXeroAccount] = useState<string>("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch integration settings
  const { data: integrationSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["accounting-integrations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const { data, error } = await supabase
        .from("accounting_integrations")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_enabled", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: externalAccounts, isLoading: isLoadingExternal, refetch: refetchExternal } = useQuery({
    queryKey: ["external-accounts", integrationSettings?.provider, accountType],
    queryFn: async () => {
      if (!integrationSettings) return [];

      if (integrationSettings.provider === 'xero') {
        const functionName = `fetch-xero-${accountType}`;
        const { data, error } = await supabase.functions.invoke(functionName);
        if (error) throw error;
        return (data?.contacts || []) as ExternalAccount[];
      }
      
      if (integrationSettings.provider === 'myob_acumatica') {
        const functionName = accountType === 'customers' 
          ? 'fetch-acumatica-customers' 
          : 'fetch-acumatica-vendors';
          
        const { data, error } = await supabase.functions.invoke(functionName);
        
        if (error) throw error;
        
        // Map Acumatica format to ExternalAccount format
        const accounts = (accountType === 'customers' ? data?.customers : data?.vendors) || [];
        return accounts.map((acc: any) => ({
          id: acc.CustomerID?.value || acc.VendorID?.value,
          name: acc.CustomerName?.value || acc.VendorName?.value,
          email: acc.MainContact?.Email?.value || acc.Email?.value || "",
          type: accountType === 'customers' ? 'customer' : 'supplier',
        })) as ExternalAccount[];
      }
      
      return [];
    },
    enabled: !!integrationSettings,
  });

  // Fetch app accounts
  const { data: appAccounts } = useQuery({
    queryKey: ["app-accounts", accountType],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return [];

      const table = accountType === 'customers' ? 'customers' : 'suppliers';
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });

  // Map external accounts to app accounts
  const mappedAccounts: MappedAccount[] = (externalAccounts || []).map(ext => {
    // Check the correct field based on integration provider
    const matchedApp = appAccounts?.find(app => {
      if (integrationSettings?.provider === 'xero') {
        return (app as any).xero_contact_id === ext.id;
      } else if (integrationSettings?.provider === 'myob_acumatica') {
        // Acumatica
        return accountType === 'customers' 
          ? (app as any).acumatica_customer_id === ext.id
          : (app as any).acumatica_vendor_id === ext.id;
      }
      // Fallback to name/email matching
      return app.name.toLowerCase() === ext.name.toLowerCase() ||
        (ext.email && app.email && app.email.toLowerCase() === ext.email.toLowerCase());
    });

    return {
      ...ext,
      appAccountId: matchedApp?.id,
      appAccountName: matchedApp?.name,
      syncStatus: matchedApp ? 'mapped' : 'unmapped',
    };
  });

  // Filter accounts based on search
  const filteredAccounts = mappedAccounts.filter(account =>
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Import accounts mutation
  const importMutation = useMutation({
    mutationFn: async (accounts: ExternalAccount[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const table = accountType === 'customers' ? 'customers' : 'suppliers';
      
      // Determine the linking field based on provider
      const linkField = integrationSettings?.provider === 'xero' 
        ? 'xero_contact_id' 
        : accountType === 'customers' 
          ? 'acumatica_customer_id' 
          : 'acumatica_vendor_id';
      
      const accountsToImport = accounts.map(a => ({
        tenant_id: profile.tenant_id,
        name: a.name,
        email: a.email,
        phone: a.phone,
        address: a.address,
        abn: a.abn,
        [linkField]: a.id, // Automatically link to external account
      }));

      const { error } = await supabase
        .from(table)
        .insert(accountsToImport);

      if (error) throw error;

      return accountsToImport.length;
    },
    onSuccess: (count) => {
      toast.success(`Successfully imported and linked ${count} ${accountType}`);
      queryClient.invalidateQueries({ queryKey: ["app-accounts", accountType] });
      queryClient.invalidateQueries({ queryKey: ["external-accounts"] });
      setSelectedAccounts(new Set());
      setImportDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to import ${accountType}: ${error.message}`);
    },
  });

  // Export accounts mutation
  const exportMutation = useMutation({
    mutationFn: async (accountIds: string[]) => {
      if (!integrationSettings) throw new Error("No integration configured");

      const functionName = integrationSettings.provider === 'xero' 
        ? `export-to-xero-${accountType}`
        : `export-to-acumatica-${accountType}`;

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { accountIds },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully exported ${data.count} ${accountType}`);
      refetchExternal();
      setSelectedAccounts(new Set());
    },
    onError: (error: Error) => {
      toast.error(`Failed to export ${accountType}: ${error.message}`);
    },
  });

  // Manual account mapping mutation
  const linkAccountMutation = useMutation({
    mutationFn: async ({ appAccountId, xeroContactId }: { appAccountId: string; xeroContactId: string }) => {
      const table = accountType === 'customers' ? 'customers' : 'suppliers';
      
      // Determine which field to update based on integration provider
      const updateField = integrationSettings?.provider === 'xero' 
        ? 'xero_contact_id' 
        : accountType === 'customers' 
          ? 'acumatica_customer_id' 
          : 'acumatica_vendor_id';
      
      const { error } = await supabase
        .from(table)
        .update({ [updateField]: xeroContactId })
        .eq('id', appAccountId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account linked successfully");
      queryClient.invalidateQueries({ queryKey: ["app-accounts", accountType] });
      setLinkDialogOpen(false);
      setSelectedAppAccount("");
      setSelectedXeroAccount("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to link account: ${error.message}`);
    },
  });

  // Unlink account mutation
  const unlinkAccountMutation = useMutation({
    mutationFn: async (appAccountId: string) => {
      const table = accountType === 'customers' ? 'customers' : 'suppliers';
      
      // Determine which field to clear based on integration provider
      const updateField = integrationSettings?.provider === 'xero' 
        ? 'xero_contact_id' 
        : accountType === 'customers' 
          ? 'acumatica_customer_id' 
          : 'acumatica_vendor_id';
      
      const { error } = await supabase
        .from(table)
        .update({ [updateField]: null })
        .eq('id', appAccountId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account unlinked successfully");
      queryClient.invalidateQueries({ queryKey: ["app-accounts", accountType] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to unlink account: ${error.message}`);
    },
  });

  const handleSelectAll = () => {
    if (selectedAccounts.size === filteredAccounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(filteredAccounts.map(a => a.id)));
    }
  };

  const handleSelectAccount = (id: string) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAccounts(newSelected);
  };

  const handleImportSelected = () => {
    setImportDialogOpen(true);
  };
  
  const handleConfirmImport = (accounts: ExternalAccount[]) => {
    importMutation.mutate(accounts);
  };

  const handleExportSelected = () => {
    const selectedAppIds = Array.from(selectedAccounts);
    exportMutation.mutate(selectedAppIds);
  };

  // Show loading state if integration settings are still loading
  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show message if no integration is enabled
  if (!integrationSettings) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No accounting integration is currently enabled. Please configure and enable an integration in the Integrations tab first.
        </AlertDescription>
      </Alert>
    );
  }

  const accountsToImport = filteredAccounts
    .filter(a => selectedAccounts.has(a.id) && a.syncStatus === 'unmapped')
    .map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      address: a.address,
      abn: a.abn,
      type: accountType === 'customers' ? 'customer' as const : 'supplier' as const,
    }));

  return (
    <div className="space-y-6">
      <ImportAccountsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        accounts={accountsToImport}
        accountType={accountType}
        provider={(integrationSettings?.provider === 'myob_acumatica' ? 'myob_acumatica' : 'xero') as 'xero' | 'myob_acumatica'}
        onConfirm={handleConfirmImport}
        isImporting={importMutation.isPending}
      />
      <Alert className="bg-primary/10 border-primary">
        <CheckCircle className="h-4 w-4 text-primary" />
        <AlertDescription>
          Connected to <strong>{integrationSettings.provider === 'xero' ? 'Xero' : 'MYOB Acumatica'}</strong>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Account Synchronization</CardTitle>
          <CardDescription>
            Import accounts from {integrationSettings.provider === 'xero' ? 'Xero' : 'MYOB Acumatica'} or export app accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={accountType} onValueChange={(v) => setAccountType(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchExternal()}
                    disabled={isLoadingExternal}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingExternal ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImportSelected}
                    disabled={selectedAccounts.size === 0 || importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import Selected ({selectedAccounts.size})
                  </Button>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedAccounts.size === filteredAccounts.length && filteredAccounts.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mapped To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingExternal ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No customers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedAccounts.has(account.id)}
                              onCheckedChange={() => handleSelectAccount(account.id)}
                              disabled={account.syncStatus === 'mapped'}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{account.name}</TableCell>
                          <TableCell>{account.email || '-'}</TableCell>
                          <TableCell>{account.phone || '-'}</TableCell>
                          <TableCell>
                            {account.syncStatus === 'mapped' ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Mapped
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Unmapped
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {account.appAccountName || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="suppliers" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Input
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchExternal()}
                    disabled={isLoadingExternal}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingExternal ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImportSelected}
                    disabled={selectedAccounts.size === 0 || importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import Selected ({selectedAccounts.size})
                  </Button>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedAccounts.size === filteredAccounts.length && filteredAccounts.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mapped To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingExternal ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredAccounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No suppliers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedAccounts.has(account.id)}
                              onCheckedChange={() => handleSelectAccount(account.id)}
                              disabled={account.syncStatus === 'mapped'}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{account.name}</TableCell>
                          <TableCell>{account.email || '-'}</TableCell>
                          <TableCell>{account.phone || '-'}</TableCell>
                          <TableCell>
                            {account.syncStatus === 'mapped' ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Mapped
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Unmapped
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {account.appAccountName || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export App Accounts</CardTitle>
          <CardDescription>
            Export {accountType} from your app to {integrationSettings.provider}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Input
              placeholder={`Search app ${accountType}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Button
              size="sm"
              onClick={handleExportSelected}
              disabled={selectedAccounts.size === 0 || exportMutation.isPending}
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Export Selected ({selectedAccounts.size})
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        appAccounts?.length > 0 &&
                        selectedAccounts.size === appAccounts.length
                      }
                      onCheckedChange={() => {
                        if (selectedAccounts.size === appAccounts?.length) {
                          setSelectedAccounts(new Set());
                        } else {
                          setSelectedAccounts(new Set((appAccounts || []).map(a => a.id)));
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!appAccounts ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : appAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No {accountType} found in app
                    </TableCell>
                  </TableRow>
                ) : (
                  appAccounts
                    .filter(account =>
                      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      account.email?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedAccounts.has(account.id)}
                            onCheckedChange={() => {
                              const newSelected = new Set(selectedAccounts);
                              if (newSelected.has(account.id)) {
                                newSelected.delete(account.id);
                              } else {
                                newSelected.add(account.id);
                              }
                              setSelectedAccounts(newSelected);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell>{account.email || '-'}</TableCell>
                        <TableCell>{account.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={account.is_active ? 'default' : 'secondary'}>
                            {account.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Manual Account Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Account Mapping</CardTitle>
          <CardDescription>
            Link existing app {accountType} to Xero contacts without importing or exporting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Use this to manually map existing accounts between your app and Xero. 
                This is useful when you already have accounts in both systems.
              </AlertDescription>
            </Alert>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App Account</TableHead>
                    <TableHead>Xero Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!appAccounts ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : appAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No {accountType} found in app
                      </TableCell>
                    </TableRow>
                  ) : (
                    appAccounts.map((appAccount) => {
                      const linkedXeroAccount = externalAccounts?.find(
                        ext => ext.id === appAccount.xero_contact_id
                      );

                      return (
                        <TableRow key={appAccount.id}>
                          <TableCell className="font-medium">{appAccount.name}</TableCell>
                          <TableCell>
                            {linkedXeroAccount ? (
                              <div className="flex items-center gap-2">
                                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                                {linkedXeroAccount.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not linked</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {linkedXeroAccount ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Linked
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Not Linked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {linkedXeroAccount ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => unlinkAccountMutation.mutate(appAccount.id)}
                                disabled={unlinkAccountMutation.isPending}
                              >
                                {unlinkAccountMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Unlink className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              <Dialog open={linkDialogOpen && selectedAppAccount === appAccount.id} onOpenChange={(open) => {
                                setLinkDialogOpen(open);
                                if (!open) {
                                  setSelectedAppAccount("");
                                  setSelectedXeroAccount("");
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedAppAccount(appAccount.id)}
                                  >
                                    <LinkIcon className="h-4 w-4 mr-1" />
                                    Link
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Link to Xero Contact</DialogTitle>
                                    <DialogDescription>
                                      Select a Xero contact to link with {appAccount.name}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label>Xero Contact</Label>
                                      <Select
                                        value={selectedXeroAccount}
                                        onValueChange={setSelectedXeroAccount}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select a Xero contact" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {externalAccounts?.map((xeroAccount) => (
                                            <SelectItem key={xeroAccount.id} value={xeroAccount.id}>
                                              {xeroAccount.name} {xeroAccount.email && `(${xeroAccount.email})`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Button
                                      className="w-full"
                                      onClick={() => {
                                        if (selectedXeroAccount) {
                                          linkAccountMutation.mutate({
                                            appAccountId: appAccount.id,
                                            xeroContactId: selectedXeroAccount,
                                          });
                                          setLinkDialogOpen(false);
                                          setSelectedAppAccount("");
                                          setSelectedXeroAccount("");
                                        }
                                      }}
                                      disabled={!selectedXeroAccount || linkAccountMutation.isPending}
                                    >
                                      {linkAccountMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      ) : (
                                        <LinkIcon className="h-4 w-4 mr-2" />
                                      )}
                                      Link Accounts
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
