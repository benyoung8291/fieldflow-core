import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

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
  type: 'customer' | 'supplier';
}

interface FieldMapping {
  sourceField: keyof ExternalAccount | 'none';
  targetField: string;
  label: string;
  description: string;
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
  
  // Initialize field mappings with all customer/supplier fields
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([
    { sourceField: 'name', targetField: 'name', label: 'Name', description: 'Business/Company name' },
    { sourceField: 'email', targetField: 'email', label: 'Email', description: 'Primary email address' },
    { sourceField: 'phone', targetField: 'phone', label: 'Phone', description: 'Primary phone number' },
    { sourceField: 'address', targetField: 'address', label: 'Address', description: 'Street address' },
    { sourceField: 'city', targetField: 'city', label: 'City', description: 'City' },
    { sourceField: 'state', targetField: 'state', label: 'State', description: 'State/Province' },
    { sourceField: 'postcode', targetField: 'postcode', label: 'Postcode', description: 'Postal/Zip code' },
    { sourceField: 'abn', targetField: 'abn', label: 'ABN', description: 'Australian Business Number' },
    { sourceField: 'legal_company_name', targetField: 'legal_company_name', label: 'Legal Company Name', description: 'Registered legal name' },
    { sourceField: 'trading_name', targetField: 'trading_name', label: 'Trading Name', description: 'Trading/DBA name' },
    { sourceField: 'billing_email', targetField: 'billing_email', label: 'Billing Email', description: 'Invoice email' },
    { sourceField: 'billing_phone', targetField: 'billing_phone', label: 'Billing Phone', description: 'Billing contact phone' },
    { sourceField: 'billing_address', targetField: 'billing_address', label: 'Billing Address', description: 'Billing address' },
    { sourceField: 'notes', targetField: 'notes', label: 'Notes', description: 'Additional notes' },
    { sourceField: 'payment_terms', targetField: 'payment_terms', label: 'Payment Terms', description: 'Payment terms (days)' },
  ]);

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

  const updateMapping = (index: number, newSourceField: string) => {
    const newMappings = [...fieldMappings];
    newMappings[index].sourceField = newSourceField as keyof ExternalAccount | 'none';
    setFieldMappings(newMappings);
  };

  // Get all possible source fields from the first account
  const availableSourceFields = accounts.length > 0 
    ? Object.keys(accounts[0]).filter(key => key !== 'type') as (keyof ExternalAccount)[]
    : [];

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
                Configure how fields from {providerName} map to your application. Select "None" to skip importing a field.
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[400px] rounded-md border">
              <div className="space-y-2 p-4">
                {fieldMappings.map((mapping, index) => (
                  <div key={mapping.targetField} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{mapping.label}</div>
                      <div className="text-xs text-muted-foreground">{mapping.description}</div>
                    </div>
                    
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    
                    <div className="w-48">
                      <Select
                        value={mapping.sourceField}
                        onValueChange={(value) => updateMapping(index, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select source field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (skip)</SelectItem>
                          {availableSourceFields.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
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
