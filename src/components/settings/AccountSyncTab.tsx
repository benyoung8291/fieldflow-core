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
import { toast } from "sonner";
import { Download, Upload, RefreshCw, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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
  const queryClient = useQueryClient();

  // Fetch integration settings
  const { data: integrationSettings } = useQuery({
    queryKey: ["accounting-integrations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

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

  // Fetch external accounts from accounting system
  const { data: externalAccounts, isLoading: isLoadingExternal, refetch: refetchExternal } = useQuery({
    queryKey: ["external-accounts", integrationSettings?.provider, accountType],
    queryFn: async () => {
      if (!integrationSettings) return [];

      const functionName = integrationSettings.provider === 'xero' 
        ? `fetch-xero-${accountType}`
        : `fetch-acumatica-${accountType}`;

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {},
      });

      if (error) throw error;
      return (data.accounts || []) as ExternalAccount[];
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
    const matchedApp = appAccounts?.find(app => 
      app.name.toLowerCase() === ext.name.toLowerCase() ||
      (ext.email && app.email && app.email.toLowerCase() === ext.email.toLowerCase())
    );

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
    mutationFn: async (accounts: MappedAccount[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const table = accountType === 'customers' ? 'customers' : 'suppliers';
      const accountsToImport = accounts
        .filter(a => a.syncStatus === 'unmapped')
        .map(a => ({
          tenant_id: profile.tenant_id,
          name: a.name,
          email: a.email,
          phone: a.phone,
          address: a.address,
          abn: a.abn,
        }));

      const { error } = await supabase
        .from(table)
        .insert(accountsToImport);

      if (error) throw error;

      return accountsToImport.length;
    },
    onSuccess: (count) => {
      toast.success(`Successfully imported ${count} ${accountType}`);
      queryClient.invalidateQueries({ queryKey: ["app-accounts", accountType] });
      setSelectedAccounts(new Set());
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
    const accountsToImport = filteredAccounts.filter(a => 
      selectedAccounts.has(a.id) && a.syncStatus === 'unmapped'
    );
    importMutation.mutate(accountsToImport);
  };

  const handleExportSelected = () => {
    const selectedAppIds = Array.from(selectedAccounts);
    exportMutation.mutate(selectedAppIds);
  };

  if (!integrationSettings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Synchronization</CardTitle>
          <CardDescription>
            Sync customers and suppliers between your app and accounting software
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No accounting integration configured. Please configure Xero or Acumatica integration first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account Synchronization</CardTitle>
          <CardDescription>
            Import accounts from {integrationSettings.provider} or export app accounts to {integrationSettings.provider}
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
    </div>
  );
}
