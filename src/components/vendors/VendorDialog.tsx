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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2 } from "lucide-react";
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
      setAbnValidated(false);
      setGstRegistered(null);
      setAvailableTradingNames([]);
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
                    <Input
                      id="abn"
                      placeholder="12 345 678 901"
                      value={formData.abn}
                      onChange={(e) => handleABNChange(e.target.value)}
                      className="flex-1"
                      required
                    />
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
                  {gstRegistered !== null && (
                    <p className={`text-sm ${gstRegistered ? 'text-green-600' : 'text-amber-600'}`}>
                      GST {gstRegistered ? 'Registered ✓' : 'Not Registered'}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tradingName">Trading Name *</Label>
                <Input
                  id="tradingName"
                  value={formData.tradingName}
                  onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                  placeholder="Enter trading name"
                  required
                />
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
