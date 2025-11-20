import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

interface ExternalAccount {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  abn?: string;
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
  const [step, setStep] = useState<'preview' | 'mapping'>('preview');

  const handleNext = () => {
    if (step === 'preview') {
      setStep('mapping');
    } else {
      onConfirm(accounts);
    }
  };

  const handleClose = () => {
    setStep('preview');
    onOpenChange(false);
  };

  const providerName = provider === 'xero' ? 'Xero' : 'MYOB Acumatica';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Import {accounts.length} {accountType === 'customers' ? 'Customer' : 'Supplier'}
            {accounts.length !== 1 ? 's' : ''} from {providerName}
          </DialogTitle>
          <DialogDescription>
            {step === 'preview' 
              ? `Review the ${accountType} that will be imported and automatically linked to ${providerName}.`
              : 'Confirm the field mapping before importing.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'preview' && (
          <div className="space-y-4">
            <Alert className="bg-primary/10 border-primary">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>
                These {accountType} will be automatically linked to your {providerName} account after import.
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>ABN</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell className="text-muted-foreground">{account.email || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{account.phone || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{account.abn || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">New</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The following fields will be mapped from {providerName} to your application:
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <div className="font-medium">{providerName} ID</div>
                    <div className="text-muted-foreground text-xs">External Account ID</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="font-medium">Linked Account ID</div>
                  <div className="text-muted-foreground text-xs">For sync tracking</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <div className="font-medium">Name</div>
                    <div className="text-muted-foreground text-xs">Business name</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="font-medium">Name</div>
                  <div className="text-muted-foreground text-xs">Primary identifier</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <div className="font-medium">Email</div>
                    <div className="text-muted-foreground text-xs">Contact email</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="font-medium">Email</div>
                  <div className="text-muted-foreground text-xs">Primary email</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <div className="font-medium">Phone</div>
                    <div className="text-muted-foreground text-xs">Contact number</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="font-medium">Phone</div>
                  <div className="text-muted-foreground text-xs">Primary phone</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <div className="font-medium">Address</div>
                    <div className="text-muted-foreground text-xs">Physical address</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <div className="font-medium">Address</div>
                  <div className="text-muted-foreground text-xs">Primary address</div>
                </div>
              </div>

              {accounts.some(a => a.abn) && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <div className="font-medium">ABN</div>
                      <div className="text-muted-foreground text-xs">Tax number</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium">ABN</div>
                    <div className="text-muted-foreground text-xs">Tax identifier</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          {step === 'preview' ? (
            <Button onClick={handleNext}>
              Next: Review Mapping
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${accounts.length} ${accountType === 'customers' ? 'Customer' : 'Supplier'}${accounts.length !== 1 ? 's' : ''}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
