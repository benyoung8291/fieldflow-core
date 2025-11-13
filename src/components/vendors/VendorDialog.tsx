import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";
import AddressAutocomplete from "@/components/customers/AddressAutocomplete";

interface VendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: any;
}

export default function VendorDialog({ open, onOpenChange, vendor }: VendorDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [validatingABN, setValidatingABN] = useState(false);
  const [abnValidated, setAbnValidated] = useState(false);
  const [gstRegistered, setGstRegistered] = useState<boolean | null>(null);
  const [availableTradingNames, setAvailableTradingNames] = useState<string[]>([]);
  const [isDuplicateABN, setIsDuplicateABN] = useState(false);
  const [duplicateVendorName, setDuplicateVendorName] = useState<string>("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    tradingName: "",
    legalName: "",
    abn: "",
    gstRegistered: false,
    email: "",
    phone: "",
    mobile: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    paymentTerms: "30",
    isActive: true,
    notes: "",
  });

  const formatABN = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const limited = digits.slice(0, 11);
    
    if (limited.length <= 2) return limited;
    if (limited.length <= 5) return `${limited.slice(0, 2)} ${limited.slice(2)}`;
    if (limited.length <= 8) return `${limited.slice(0, 2)} ${limited.slice(2, 5)} ${limited.slice(5)}`;
    return `${limited.slice(0, 2)} ${limited.slice(2, 5)} ${limited.slice(5, 8)} ${limited.slice(8)}`;
  };

  const handleABNChange = (value: string) => {
    const formatted = formatABN(value);
    setFormData({ ...formData, abn: formatted });
    setAbnValidated(false);
    setGstRegistered(null);
    setIsDuplicateABN(false);
    setDuplicateVendorName("");
  };

  const handleValidateABN = async () => {
    if (!formData.abn) {
      toast.error('Please enter an ABN first');
      return;
    }

    setValidatingABN(true);
    try {
      // Strip spaces before sending to API
      const cleanABN = formData.abn.replace(/\s/g, '');
      const { data, error } = await supabase.functions.invoke('validate-abn', {
        body: { abn: cleanABN },
      });

      if (error) throw error;

      if (!data.valid) {
        toast.error(data.error || 'ABN is not valid');
        setAbnValidated(false);
        setGstRegistered(null);
        return;
      }

      // Check for duplicate ABN
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (profile?.tenant_id) {
          let duplicateQuery = supabase
            .from("vendors")
            .select("id, name")
            .eq("tenant_id", profile.tenant_id)
            .eq("abn", formData.abn);

          if (vendor) {
            duplicateQuery = duplicateQuery.neq("id", vendor.id);
          }

          const { data: duplicateVendor } = await duplicateQuery.maybeSingle();

          if (duplicateVendor) {
            setIsDuplicateABN(true);
            setDuplicateVendorName(duplicateVendor.name);
          } else {
            setIsDuplicateABN(false);
            setDuplicateVendorName("");
          }
        }
      }

      setAbnValidated(true);
      setGstRegistered(data.gstRegistered);
      setAvailableTradingNames(data.tradingNames || []);
      
      setFormData(prev => ({
        ...prev,
        legalName: data.legalName || prev.legalName,
        gstRegistered: data.gstRegistered,
      }));

      toast.success(
        <div>
          <div className="font-medium">ABN Validated Successfully</div>
          <div className="text-sm text-muted-foreground">
            {data.entityType} • GST {data.gstRegistered ? 'Registered ✓' : 'Not Registered'}
          </div>
        </div>
      );
    } catch (error: any) {
      console.error('ABN validation error:', error);
      toast.error(error.message || 'Failed to validate ABN');
      setAbnValidated(false);
      setGstRegistered(null);
    } finally {
      setValidatingABN(false);
    }
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

        if (!profile?.tenant_id) return;

        const { data, error } = await supabase
          .from("customers")
          .select("id, name, trading_name")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        setCustomers(data || []);
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };

    if (open) {
      fetchCustomers();
    }

    if (vendor) {
      setFormData({
        name: vendor.name || "",
        tradingName: vendor.trading_name || "",
        legalName: vendor.legal_company_name || "",
        abn: vendor.abn || "",
        gstRegistered: vendor.gst_registered || false,
        email: vendor.email || "",
        phone: vendor.phone || "",
        mobile: vendor.mobile || "",
        address: vendor.address || "",
        city: vendor.city || "",
        state: vendor.state || "",
        postcode: vendor.postcode || "",
        paymentTerms: vendor.payment_terms?.toString() || "30",
        isActive: vendor.is_active ?? true,
        notes: vendor.notes || "",
      });
      setLinkedCustomerId(vendor.customer_id || null);
      setAbnValidated(false);
      setGstRegistered(vendor.gst_registered || false);
      setAvailableTradingNames([]);
    } else {
      setFormData({
        name: "",
        tradingName: "",
        legalName: "",
        abn: "",
        gstRegistered: false,
        email: "",
        phone: "",
        mobile: "",
        address: "",
        city: "",
        state: "",
        postcode: "",
        paymentTerms: "30",
        isActive: true,
        notes: "",
      });
      setLinkedCustomerId(null);
      setAbnValidated(false);
      setGstRegistered(null);
      setAvailableTradingNames([]);
      setIsDuplicateABN(false);
      setDuplicateVendorName("");
    }
  }, [vendor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Check for duplicate ABN
      if (formData.abn) {
        const cleanABN = formData.abn.replace(/\s/g, '');
        let duplicateQuery = supabase
          .from("vendors")
          .select("id, name")
          .eq("tenant_id", profile.tenant_id)
          .eq("abn", formData.abn);

        // If editing, exclude current vendor from check
        if (vendor) {
          duplicateQuery = duplicateQuery.neq("id", vendor.id);
        }

        const { data: duplicateVendor } = await duplicateQuery.maybeSingle();

        if (duplicateVendor) {
          toast.error(`A vendor with ABN ${formData.abn} already exists: ${duplicateVendor.name}`);
          setSaving(false);
          return;
        }
      }

      const vendorData = {
        name: formData.tradingName || formData.name,
        trading_name: formData.tradingName || null,
        legal_company_name: formData.legalName || null,
        abn: formData.abn || null,
        gst_registered: formData.gstRegistered,
        email: formData.email || null,
        phone: formData.phone || null,
        mobile: formData.mobile || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        postcode: formData.postcode || null,
        payment_terms: parseInt(formData.paymentTerms, 10),
        is_active: formData.isActive,
        notes: formData.notes || null,
        tenant_id: profile.tenant_id,
        customer_id: linkedCustomerId || null,
      };

      if (vendor) {
        const { error } = await supabase
          .from("vendors")
          .update(vendorData)
          .eq("id", vendor.id);

        if (error) throw error;
        toast.success("Vendor updated successfully");
      } else {
        const { error } = await supabase
          .from("vendors")
          .insert(vendorData);

        if (error) throw error;
        toast.success("Vendor created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving vendor:", error);
      toast.error(error.message || "Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {vendor ? "Edit Vendor" : "New Vendor"}
          </DialogTitle>
          <DialogDescription>
            {vendor ? "Update vendor/supplier information" : "Add a new vendor/supplier to your system"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {linkedCustomerId && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                This vendor is also a customer in your system
              </span>
            </div>
          )}

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="additional">Additional</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal Company Name *</Label>
                  <Input
                    id="legalName"
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    disabled
                    className="bg-muted"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abn">ABN *</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        id="abn"
                        placeholder="12 345 678 901"
                        value={formData.abn}
                        onChange={(e) => handleABNChange(e.target.value)}
                        className={isDuplicateABN ? "pr-10 border-amber-500" : ""}
                        required
                      />
                      {isDuplicateABN && (
                        <AlertTriangle className="h-4 w-4 text-amber-500 absolute right-3 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant={abnValidated ? "default" : "outline"}
                      size="sm"
                      onClick={handleValidateABN}
                      disabled={validatingABN || !formData.abn}
                    >
                      {validatingABN ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : abnValidated ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        "Check"
                      )}
                    </Button>
                  </div>
                  {isDuplicateABN && (
                    <p className="text-sm text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      This ABN is already used by: {duplicateVendorName}
                    </p>
                  )}
                  {gstRegistered !== null && !isDuplicateABN && (
                    <p className={`text-sm ${gstRegistered ? 'text-green-600' : 'text-amber-600'}`}>
                      GST {gstRegistered ? 'Registered ✓' : 'Not Registered'}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradingName">Trading Name *</Label>
                {availableTradingNames.length > 0 ? (
                  <div className="space-y-2">
                    <Select
                      value={formData.tradingName}
                      onValueChange={(value) => setFormData({ ...formData, tradingName: value })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select a trading name" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {availableTradingNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__">Enter custom name</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.tradingName === "__custom__" && (
                      <Input
                        value=""
                        onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                        placeholder="Enter custom trading name"
                        autoFocus
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    id="tradingName"
                    value={formData.tradingName}
                    onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                    placeholder="Enter trading name"
                    required
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <AddressAutocomplete
                  value={formData.address}
                  onChange={(value) => setFormData({ ...formData, address: value })}
                  onPlaceSelect={(place) => setFormData({
                    ...formData,
                    address: place.address,
                    city: place.city,
                    state: place.state,
                    postcode: place.postcode,
                  })}
                  placeholder="Start typing to search address..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City/Suburb</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="additional" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="linkedCustomer">Link to Customer (Optional)</Label>
                <Select
                  value={linkedCustomerId || "none"}
                  onValueChange={(value) => setLinkedCustomerId(value === "none" ? null : value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">Not linked to a customer</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.trading_name || customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link this vendor to a customer if they are also a client of your business
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
                <Input
                  id="paymentTerms"
                  type="number"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Active Vendor</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                vendor ? "Update Vendor" : "Create Vendor"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
