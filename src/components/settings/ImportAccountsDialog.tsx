import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, CheckCircle2, Edit2 } from "lucide-react";

interface ExternalAccount {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  abn?: string;
  legal_company_name?: string;
  trading_name?: string;
  billing_email?: string;
  billing_phone?: string;
  billing_address?: string;
  notes?: string;
  payment_terms?: number;
  acumatica_customer_id?: string;
  acumatica_vendor_id?: string;
  type: 'customer' | 'supplier';
}

interface ImportAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: ExternalAccount[];
  accountType: 'customers' | 'suppliers';
  provider: 'xero' | 'myob_acumatica';
  onConfirm: (accounts: ExternalAccount[]) => void;
  isImporting: boolean;
}

export function ImportAccountsDialog({
  open,
  onOpenChange,
  accounts,
  accountType,
  provider,
  onConfirm,
  isImporting,
}: ImportAccountsDialogProps) {
  const [editableAccounts, setEditableAccounts] = useState<ExternalAccount[]>(accounts);
  const [editingRow, setEditingRow] = useState<string | null>(null);

  const providerName = provider === 'xero' ? 'Xero' : 'MYOB Acumatica';

  const handleFieldChange = (accountId: string, field: keyof ExternalAccount, value: string) => {
    setEditableAccounts(prev => 
      prev.map(acc => 
        acc.id === accountId 
          ? { ...acc, [field]: field === 'payment_terms' ? parseInt(value) || 0 : value }
          : acc
      )
    );
  };

  const handleClose = () => {
    setEditableAccounts(accounts);
    setEditingRow(null);
    onOpenChange(false);
  };

  const handleImport = () => {
    onConfirm(editableAccounts);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Import {editableAccounts.length} {accountType === 'customers' ? 'Customer' : 'Supplier'}
            {editableAccounts.length !== 1 ? 's' : ''} from {providerName}
          </DialogTitle>
          <DialogDescription>
            Review and edit the data below before importing. ABN validation will be performed during import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              Click any field to edit. These {accountType} will be automatically linked to your {providerName} account after import.
            </AlertDescription>
          </Alert>

          <ScrollArea className="h-[500px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  {provider === 'myob_acumatica' && (
                    <TableHead className="w-[150px]">
                      MYOB {accountType === 'customers' ? 'Customer' : 'Supplier'} ID
                    </TableHead>
                  )}
                  <TableHead className="w-[150px]">ABN</TableHead>
                  <TableHead className="w-[150px]">Email</TableHead>
                  <TableHead className="w-[120px]">Phone</TableHead>
                  <TableHead className="w-[180px]">Address</TableHead>
                  <TableHead className="w-[100px]">City</TableHead>
                  <TableHead className="w-[80px]">State</TableHead>
                  <TableHead className="w-[100px]">Postcode</TableHead>
                  <TableHead className="w-[150px]">Billing Email</TableHead>
                  <TableHead className="w-[120px]">Payment Terms</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editableAccounts.map((account) => {
                  const isEditing = editingRow === account.id;
                  return (
                    <TableRow key={account.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={account.name || ''}
                            onChange={(e) => handleFieldChange(account.id, 'name', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="font-medium">{account.name}</span>
                        )}
                      </TableCell>
                      {provider === 'myob_acumatica' && (
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={accountType === 'customers' ? (account.acumatica_customer_id || '') : (account.acumatica_vendor_id || '')}
                              onChange={(e) => handleFieldChange(
                                account.id, 
                                accountType === 'customers' ? 'acumatica_customer_id' : 'acumatica_vendor_id',
                                e.target.value
                              )}
                              className="h-8"
                              placeholder="MYOB ID"
                            />
                          ) : (
                            <span className="text-muted-foreground font-mono text-sm">
                              {accountType === 'customers' ? account.acumatica_customer_id : account.acumatica_vendor_id || '-'}
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={account.abn || ''}
                            onChange={(e) => handleFieldChange(account.id, 'abn', e.target.value)}
                            className="h-8"
                            placeholder="ABN"
                          />
                        ) : (
                          <span className="text-muted-foreground">{account.abn || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={account.email || ''}
                            onChange={(e) => handleFieldChange(account.id, 'email', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{account.email || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={account.phone || ''}
                            onChange={(e) => handleFieldChange(account.id, 'phone', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{account.phone || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={account.address || ''}
                            onChange={(e) => handleFieldChange(account.id, 'address', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{account.address || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={account.city || ''}
                            onChange={(e) => handleFieldChange(account.id, 'city', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{account.city || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={account.state || ''}
                            onChange={(e) => handleFieldChange(account.id, 'state', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{account.state || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={account.postcode || ''}
                            onChange={(e) => handleFieldChange(account.id, 'postcode', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{account.postcode || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={account.billing_email || ''}
                            onChange={(e) => handleFieldChange(account.id, 'billing_email', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{account.billing_email || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={account.payment_terms || ''}
                            onChange={(e) => handleFieldChange(account.id, 'payment_terms', e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          <span className="text-muted-foreground">{account.payment_terms || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRow(isEditing ? null : account.id)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing and validating ABNs...
              </>
            ) : (
              `Import ${editableAccounts.length} ${accountType === 'customers' ? 'Customer' : 'Supplier'}${editableAccounts.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
