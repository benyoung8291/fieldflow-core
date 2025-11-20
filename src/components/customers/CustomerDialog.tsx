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
import { usePresence } from "@/hooks/usePresence";
import PresenceIndicator from "@/components/presence/PresenceIndicator";
import FieldPresenceWrapper from "@/components/presence/FieldPresenceWrapper";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, Link2 } from "lucide-react";
import AddressAutocomplete from "@/components/customers/AddressAutocomplete";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: any;
  parentCustomerId?: string;
  leadId?: string;
  leadData?: any;
  onCustomerCreated?: (customerId: string) => void;
}

export default function CustomerDialog({ open, onOpenChange, customer, parentCustomerId, leadId, leadData, onCustomerCreated }: CustomerDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [validatingABN, setValidatingABN] = useState(false);
  const [abnValidated, setAbnValidated] = useState(false);
  const [availableTradingNames, setAvailableTradingNames] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [linkedVendorId, setLinkedVendorId] = useState<string | null>(null);
  const [currentField, setCurrentField] = useState<string>("");
  const { onlineUsers, updateField, updateCursorPosition } = usePresence({
    page: "customer-dialog",
    field: currentField,
  });

  // Track mouse movement for cursor sharing
  useEffect(() => {
    if (!open) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateCursorPosition(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [open, updateCursorPosition]);

  const [formData, setFormData] = useState({
    customerType: "company" as "individual" | "company",
    name: "",
    tradingName: "",
    legalName: "",
    abn: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    billingEmail: "",
    billingPhone: "",
    billingAddress: "",
    paymentTerms: "0",
    taxExempt: false,
    isActive: true,
    notes: "",
    acumaticaCustomerId: "",
  });

  const formatABN = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Limit to 11 digits
    const limited = digits.slice(0, 11);
    
    // Format as XX XXX XXX XXX
    if (limited.length <= 2) return limited;
    if (limited.length <= 5) return `${limited.slice(0, 2)} ${limited.slice(2)}`;
    if (limited.length <= 8) return `${limited.slice(0, 2)} ${limited.slice(2, 5)} ${limited.slice(5)}`;
    return `${limited.slice(0, 2)} ${limited.slice(2, 5)} ${limited.slice(5, 8)} ${limited.slice(8)}`;
  };

  const handleABNChange = (value: string) => {
    const formatted = formatABN(value);
    setFormData({ ...formData, abn: formatted });
    setAbnValidated(false); // Reset validation when ABN changes
  };

  const handleValidateABN = async () => {
    if (!formData.abn) {
      toast.error('Please enter an ABN first');
      return;
    }

    setValidatingABN(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-abn', {
        body: { abn: formData.abn },
      });

      if (error) throw error;

      if (!data.valid) {
        toast.error(data.error || 'ABN is not valid');
        setAbnValidated(false);
        return;
      }

      // ABN is valid - update form with returned data
      setAbnValidated(true);
      setAvailableTradingNames(data.tradingNames || []);
      
      setFormData(prev => ({
        ...prev,
        legalName: data.legalName || prev.legalName,
      }));

      toast.success(
        <div>
          <div className="font-medium">ABN Validated Successfully</div>
          <div className="text-sm text-muted-foreground">
            {data.entityType} • GST {data.gstRegistered ? 'Registered' : 'Not Registered'}
          </div>
        </div>
      );
    } catch (error: any) {
      console.error('ABN validation error:', error);
      toast.error(error.message || 'Failed to validate ABN');
      setAbnValidated(false);
    } finally {
      setValidatingABN(false);
    }
  };

  useEffect(() => {
    const fetchSuppliers = async () => {
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
          .from("suppliers")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .order("name");

        if (error) throw error;
        setSuppliers(data || []);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };

    if (open) {
      fetchSuppliers();
    }

    if (customer) {
      setFormData({
        customerType: customer.customer_type || "company",
        name: customer.name || "",
        tradingName: customer.trading_name || "",
        legalName: customer.legal_company_name || "",
        abn: customer.abn || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        postcode: customer.postcode || "",
        billingEmail: customer.billing_email || "",
        billingPhone: customer.billing_phone || "",
        billingAddress: customer.billing_address || "",
        paymentTerms: customer.payment_terms?.toString() || "30",
        taxExempt: customer.tax_exempt || false,
        isActive: customer.is_active ?? true,
        notes: customer.notes || "",
        acumaticaCustomerId: customer.acumatica_customer_id || "",
      });
      setLinkedVendorId(customer.supplier_id || null);
      setAbnValidated(false);
      setAvailableTradingNames([]);
    } else if (leadData) {
      // Pre-populate form with lead data for conversion
      setFormData({
        customerType: "company",
        name: leadData.name || "",
        tradingName: leadData.company_name || "",
        legalName: "",
        abn: leadData.abn || "",
        email: leadData.email || "",
        phone: leadData.phone || "",
        address: leadData.address || "",
        city: leadData.city || "",
        state: leadData.state || "",
        postcode: leadData.postcode || "",
        billingEmail: "",
        billingPhone: "",
        billingAddress: "",
        paymentTerms: "0",
        taxExempt: false,
        isActive: true,
        notes: leadData.notes || "",
        acumaticaCustomerId: "",
      });
      setLinkedVendorId(null);
      setAbnValidated(false);
      setAvailableTradingNames([]);
    } else {
      // Reset form for new customer
      setFormData({
        customerType: "company",
        name: "",
        tradingName: "",
        legalName: "",
        abn: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        postcode: "",
        billingEmail: "",
        billingPhone: "",
        billingAddress: "",
        paymentTerms: "0",
        taxExempt: false,
        isActive: true,
        notes: "",
        acumaticaCustomerId: "",
      });
      setLinkedVendorId(null);
      setAbnValidated(false);
      setAvailableTradingNames([]);
    }
  }, [customer, leadData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Get current user's tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Map form data to database columns (snake_case)
      const customerData = {
        customer_type: formData.customerType,
        name: formData.customerType === "company" ? formData.tradingName : formData.name,
        trading_name: formData.customerType === "company" ? formData.tradingName : null,
        legal_company_name: formData.customerType === "company" ? formData.legalName : null,
        abn: formData.customerType === "company" ? formData.abn : null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        postcode: formData.postcode || null,
        billing_email: formData.billingEmail || null,
        billing_phone: formData.billingPhone || null,
        billing_address: formData.billingAddress || null,
        payment_terms: parseInt(formData.paymentTerms, 10),
        tax_exempt: formData.taxExempt,
        is_active: formData.isActive,
        notes: formData.notes || null,
        tenant_id: profile.tenant_id,
        parent_customer_id: parentCustomerId || null,
        supplier_id: linkedVendorId || null,
        acumatica_customer_id: formData.acumaticaCustomerId || null,
      };

      if (customer) {
        // Update existing customer
        const { error } = await supabase
          .from("customers")
          .update(customerData)
          .eq("id", customer.id);

        if (error) throw error;
        toast.success("Customer updated successfully");
        
        // Invalidate queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ["customers"] });
        queryClient.invalidateQueries({ queryKey: ["customer-sub-accounts"] });
        onOpenChange(false);
      } else {
        // Create new customer
        const { data: newCustomer, error } = await supabase
          .from("customers")
          .insert(customerData)
          .select()
          .single();

        if (error) throw error;
        
        // If creating from a lead, update the lead and transfer related documents
        if (leadId && newCustomer) {
          console.log("Converting lead to customer:", { leadId, customerId: newCustomer.id });
          
          // Update lead with conversion details
          const { error: leadUpdateError } = await supabase
            .from("leads")
            .update({
              converted_to_customer_id: newCustomer.id,
              converted_at: new Date().toISOString(),
              converted_by: user.id,
            })
            .eq("id", leadId);
          
          if (leadUpdateError) {
            console.error("Failed to update lead:", leadUpdateError);
            throw new Error(`Failed to link lead to customer: ${leadUpdateError.message}`);
          }
          
          // Transfer all contacts from lead to customer
          const { error: contactsError } = await supabase
            .from("contacts")
            .update({
              customer_id: newCustomer.id,
              lead_id: null,
              contact_type: "customer",
              status: "active",
            })
            .eq("lead_id", leadId);
          
          if (contactsError) {
            console.error("Failed to transfer contacts:", contactsError);
            // Don't throw here, just log - contacts transfer is not critical
          }
          
          // Transfer all quotes from lead to customer (keep lead_id for history)
          const { error: quotesError } = await supabase
            .from("quotes")
            .update({
              customer_id: newCustomer.id,
            })
            .eq("lead_id", leadId);
          
          if (quotesError) {
            console.error("Failed to transfer quotes:", quotesError);
            throw new Error(`Failed to link quotes to customer: ${quotesError.message}`);
          }
          
          console.log("Lead conversion completed successfully");
          queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          queryClient.invalidateQueries({ queryKey: ["contacts"] });
          queryClient.invalidateQueries({ queryKey: ["quotes"] });
        }
        
        toast.success("Customer created successfully");
        
        // Invalidate queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ["customers"] });
        queryClient.invalidateQueries({ queryKey: ["customer-sub-accounts"] });
        
        // Call callback if provided (for lead conversion)
        if (onCustomerCreated && newCustomer) {
          onCustomerCreated(newCustomer.id);
        }
        
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error saving customer:", error);
      toast.error(error.message || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyBillingAddress = () => {
    setFormData(prev => ({
      ...prev,
      billingEmail: prev.email,
      billingPhone: prev.phone,
      billingAddress: prev.address,
    }));
    toast.success("Contact details copied to billing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>
                {customer ? "Edit Customer" : parentCustomerId ? "New Sub-Account" : "New Customer"}
              </DialogTitle>
              <DialogDescription>
                {customer ? "Update customer information and billing details" : parentCustomerId ? "Add a new sub-account under this customer" : "Add a new customer to your system"}
              </DialogDescription>
            </div>
            <PresenceIndicator users={onlineUsers} />
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {linkedVendorId && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                This customer is also a supplier in your system
              </span>
            </div>
          )}

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="additional">Additional</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              {/* Customer Type Toggle */}
              <div className="space-y-2">
                <Label>Customer Type</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="customerType"
                      value="company"
                      checked={formData.customerType === "company"}
                      onChange={(e) => setFormData({ ...formData, customerType: e.target.value as "company" })}
                      className="w-4 h-4"
                    />
                    <span>Company</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="customerType"
                      value="individual"
                      checked={formData.customerType === "individual"}
                      onChange={(e) => setFormData({ ...formData, customerType: e.target.value as "individual" })}
                      className="w-4 h-4"
                    />
                    <span>Individual</span>
                  </label>
                </div>
              </div>

              {/* Individual Name - Only show for individuals */}
              {formData.customerType === "individual" && (
                <FieldPresenceWrapper fieldName="name" onlineUsers={onlineUsers}>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onFocus={() => {
                        setCurrentField("name");
                        updateField("name");
                      }}
                      onBlur={() => {
                        setCurrentField("");
                        updateField("");
                      }}
                      required
                    />
                  </div>
                </FieldPresenceWrapper>
              )}

              {/* Company Fields - Only show for companies */}
              {formData.customerType === "company" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldPresenceWrapper fieldName="legalName" onlineUsers={onlineUsers}>
                      <div className="space-y-2">
                        <Label htmlFor="legalName">Legal Company Name *</Label>
                        <Input
                          id="legalName"
                          value={formData.legalName}
                          onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                          onFocus={() => {
                            setCurrentField("legalName");
                            updateField("legalName");
                          }}
                          onBlur={() => {
                            setCurrentField("");
                            updateField("");
                          }}
                          disabled
                          className="bg-muted"
                          required
                        />
                      </div>
                    </FieldPresenceWrapper>
                    <FieldPresenceWrapper fieldName="abn" onlineUsers={onlineUsers}>
                      <div className="space-y-2">
                        <Label htmlFor="abn">ABN *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="abn"
                            placeholder="12 345 678 901"
                            value={formData.abn}
                            onChange={(e) => handleABNChange(e.target.value)}
                            onFocus={() => {
                              setCurrentField("abn");
                              updateField("abn");
                            }}
                            onBlur={() => {
                              setCurrentField("");
                              updateField("");
                            }}
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
                      </div>
                    </FieldPresenceWrapper>
                  </div>

                  {/* Trading Name - Always editable input for companies */}
                  <FieldPresenceWrapper fieldName="tradingName" onlineUsers={onlineUsers}>
                    <div className="space-y-2">
                      <Label htmlFor="tradingName">Trading Name *</Label>
                      <Input
                        id="tradingName"
                        value={formData.tradingName}
                        onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                        onFocus={() => {
                          setCurrentField("tradingName");
                          updateField("tradingName");
                        }}
                        onBlur={() => {
                          setCurrentField("");
                          updateField("");
                        }}
                        placeholder="Enter trading name"
                        required
                      />
                    </div>
                  </FieldPresenceWrapper>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select value={formData.state} onValueChange={(v) => setFormData({ ...formData, state: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NSW">NSW</SelectItem>
                      <SelectItem value="VIC">VIC</SelectItem>
                      <SelectItem value="QLD">QLD</SelectItem>
                      <SelectItem value="SA">SA</SelectItem>
                      <SelectItem value="WA">WA</SelectItem>
                      <SelectItem value="TAS">TAS</SelectItem>
                      <SelectItem value="NT">NT</SelectItem>
                      <SelectItem value="ACT">ACT</SelectItem>
                    </SelectContent>
                  </Select>
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

            <TabsContent value="billing" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={handleCopyBillingAddress}>
                  Copy from General Info
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billingEmail">Billing Email *</Label>
                  <Input
                    id="billingEmail"
                    type="email"
                    value={formData.billingEmail}
                    onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingPhone">Billing Phone *</Label>
                  <Input
                    id="billingPhone"
                    value={formData.billingPhone}
                    onChange={(e) => setFormData({ ...formData, billingPhone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingAddress">Billing Address *</Label>
                <Textarea
                  id="billingAddress"
                  value={formData.billingAddress}
                  onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
                  <Select value={formData.paymentTerms} onValueChange={(v) => setFormData({ ...formData, paymentTerms: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Due on Receipt</SelectItem>
                      <SelectItem value="7">Net 7</SelectItem>
                      <SelectItem value="14">Net 14</SelectItem>
                      <SelectItem value="30">Net 30</SelectItem>
                      <SelectItem value="60">Net 60</SelectItem>
                      <SelectItem value="90">Net 90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxExempt" className="flex items-center gap-2">
                    Tax Exempt
                  </Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      id="taxExempt"
                      checked={formData.taxExempt}
                      onCheckedChange={(checked) => setFormData({ ...formData, taxExempt: checked })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {formData.taxExempt ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="additional" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="linkedVendor">Link to Supplier (Optional)</Label>
                <Select
                  value={linkedVendorId || "none"}
                  onValueChange={(value) => setLinkedVendorId(value === "none" ? null : value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">Not linked to a supplier</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.trading_name || supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link this customer to a supplier if they also provide goods or services to your business
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="acumaticaCustomerId">MYOB Customer Number</Label>
                <Input
                  id="acumaticaCustomerId"
                  value={formData.acumaticaCustomerId}
                  onChange={(e) => setFormData({ ...formData, acumaticaCustomerId: e.target.value })}
                  placeholder="Enter MYOB Customer ID"
                />
                <p className="text-xs text-muted-foreground">
                  Link this customer to MYOB Acumatica by entering their Customer ID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={5}
                  placeholder="Additional notes about this customer..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active Customer</Label>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>{customer ? "Update" : "Create"} Customer</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
