import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import AddressAutocomplete from "@/components/customers/AddressAutocomplete";

export default function GeneralSettingsTab() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    companyName: "",
    companyLegalName: "",
    abn: "",
    companyPhone: "",
    companyEmail: "",
    companyWebsite: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postcode: "",
    country: "Australia",
    logoUrl: "",
    primaryColor: "",
    secondaryColor: "",
    renewalEmail: "",
    // Bank details for invoices
    bankName: "",
    bankBsb: "",
    bankAccountNumber: "",
    bankAccountName: "",
    paymentInstructions: "",
  });
  const [serviceOrderLookaheadDays, setServiceOrderLookaheadDays] = useState<number>(30);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings" as any)
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
  });

  const { data: generalSettings } = useQuery({
    queryKey: ["general-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("general_settings" as any)
        .select("service_order_generation_lookahead_days")
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        companyName: settings.company_name || "",
        companyLegalName: settings.company_legal_name || "",
        abn: settings.abn || "",
        companyPhone: settings.company_phone || "",
        companyEmail: settings.company_email || "",
        companyWebsite: settings.company_website || "",
        addressLine1: settings.address_line_1 || "",
        addressLine2: settings.address_line_2 || "",
        city: settings.city || "",
        state: settings.state || "",
        postcode: settings.postcode || "",
        country: settings.country || "Australia",
        logoUrl: settings.logo_url || "",
        primaryColor: settings.primary_color || "",
        secondaryColor: settings.secondary_color || "",
        renewalEmail: settings.renewal_notification_email || "",
        // Bank details
        bankName: settings.bank_name || "",
        bankBsb: settings.bank_bsb || "",
        bankAccountNumber: settings.bank_account_number || "",
        bankAccountName: settings.bank_account_name || "",
        paymentInstructions: settings.payment_instructions || "",
      });
    }
  }, [settings]);

  useEffect(() => {
    if (generalSettings) {
      setServiceOrderLookaheadDays(generalSettings.service_order_generation_lookahead_days || 30);
    }
  }, [generalSettings]);

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.tenant_id}/logo.${fileExt}`;

      // Delete old logo if exists
      if (formData.logoUrl) {
        const oldPath = formData.logoUrl.split('/company-logos/')[1];
        if (oldPath) {
          await supabase.storage.from('company-logos').remove([oldPath]);
        }
      }

      const { error: uploadError, data } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      setFormData({ ...formData, logoUrl: publicUrl });
      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      toast.error(`Failed to upload logo: ${error.message}`);
    } finally {
      setUploadingLogo(false);
      setLogoFile(null);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error("File must be an image");
        return;
      }
      setLogoFile(file);
      handleLogoUpload(file);
    }
  };

  const handleRemoveLogo = () => {
    setFormData({ ...formData, logoUrl: "" });
    setLogoFile(null);
  };

  const updateSettingsMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("No tenant found");

      // Update tenant settings
      const updateData = {
        company_name: formData.companyName,
        company_legal_name: formData.companyLegalName,
        abn: formData.abn,
        company_phone: formData.companyPhone,
        company_email: formData.companyEmail,
        company_website: formData.companyWebsite,
        address_line_1: formData.addressLine1,
        address_line_2: formData.addressLine2,
        city: formData.city,
        state: formData.state,
        postcode: formData.postcode,
        country: formData.country,
        logo_url: formData.logoUrl,
        primary_color: formData.primaryColor,
        secondary_color: formData.secondaryColor,
        renewal_notification_email: formData.renewalEmail,
        // Bank details
        bank_name: formData.bankName,
        bank_bsb: formData.bankBsb,
        bank_account_number: formData.bankAccountNumber,
        bank_account_name: formData.bankAccountName,
        payment_instructions: formData.paymentInstructions,
      };

      if (settings) {
        const { error } = await supabase
          .from("tenant_settings" as any)
          .update(updateData)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_settings" as any)
          .insert({
            tenant_id: profile.tenant_id,
            ...updateData,
          });

        if (error) throw error;
      }

      // Update general settings
      const { error: generalError } = await supabase
        .from("general_settings" as any)
        .upsert({
          tenant_id: profile.tenant_id,
          service_order_generation_lookahead_days: serviceOrderLookaheadDays,
        });

      if (generalError) throw generalError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      queryClient.invalidateQueries({ queryKey: ["general-settings"] });
      toast.success("Settings updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Basic company details and legal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name *</Label>
              <Input
                id="company-name"
                placeholder="ABC Services Pty Ltd"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-legal-name">Legal Company Name</Label>
              <Input
                id="company-legal-name"
                placeholder="ABC Services Pty Ltd"
                value={formData.companyLegalName}
                onChange={(e) => setFormData({ ...formData, companyLegalName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abn">ABN</Label>
              <Input
                id="abn"
                placeholder="12 345 678 901"
                value={formData.abn}
                onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
          <CardDescription>
            Company contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-phone">Phone Number</Label>
              <Input
                id="company-phone"
                type="tel"
                placeholder="(02) 1234 5678"
                value={formData.companyPhone}
                onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Email Address</Label>
              <Input
                id="company-email"
                type="email"
                placeholder="info@company.com"
                value={formData.companyEmail}
                onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company-website">Website</Label>
              <Input
                id="company-website"
                type="url"
                placeholder="https://www.company.com"
                value={formData.companyWebsite}
                onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Address</CardTitle>
          <CardDescription>
            Primary business location
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address-line-1">Address Line 1</Label>
            <AddressAutocomplete
              value={formData.addressLine1}
              onChange={(value) => setFormData({ ...formData, addressLine1: value })}
              onPlaceSelect={(place) => setFormData({
                ...formData,
                addressLine1: place.address,
                city: place.city,
                state: place.state,
                postcode: place.postcode,
              })}
              placeholder="Start typing to search address..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-line-2">Address Line 2</Label>
            <Input
              id="address-line-2"
              placeholder="Suite 456"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Sydney"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="NSW"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                placeholder="2000"
                value={formData.postcode}
                onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              placeholder="Australia"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Company logo and brand colors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Company Logo</Label>
            {formData.logoUrl ? (
              <div className="space-y-2">
                <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-muted">
                  <img
                    src={formData.logoUrl}
                    alt="Company logo"
                    className="w-full h-full object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <Label htmlFor="logo-upload" className="cursor-pointer">
                  <span className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </span>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    PNG, JPG up to 5MB
                  </span>
                </Label>
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFileChange}
                  disabled={uploadingLogo}
                />
              </div>
            )}
            {uploadingLogo && (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <Input
                id="primary-color"
                placeholder="#0066CC"
                value={formData.primaryColor}
                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <Input
                id="secondary-color"
                placeholder="#FF6600"
                value={formData.secondaryColor}
                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contract Renewal Notifications</CardTitle>
          <CardDescription>
            Configure where contract renewal notifications are sent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="renewal-email">Notification Email Address</Label>
            <Input
              id="renewal-email"
              type="email"
              placeholder="contracts@company.com"
              value={formData.renewalEmail}
              onChange={(e) => setFormData({ ...formData, renewalEmail: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Automated renewal reminders will be sent to this email address 30, 60, and 90 days before contract expiry
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Order Generation</CardTitle>
          <CardDescription>
            Configure automatic service order generation from contracts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lookahead-days">Generation Lookahead Days</Label>
            <Input
              id="lookahead-days"
              type="number"
              min="1"
              max="365"
              placeholder="30"
              value={serviceOrderLookaheadDays}
              onChange={(e) => setServiceOrderLookaheadDays(parseInt(e.target.value) || 30)}
            />
            <p className="text-sm text-muted-foreground">
              Number of days to look ahead when automatically generating service orders from contracts. 
              The system will generate service orders for any contract items scheduled within this period. 
              Runs daily at midnight. Default is 30 days.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Details</CardTitle>
          <CardDescription>
            Payment details shown on invoices for customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Input
                id="bank-name"
                placeholder="Commonwealth Bank"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-account-name">Account Name</Label>
              <Input
                id="bank-account-name"
                placeholder="ABC Services Pty Ltd"
                value={formData.bankAccountName}
                onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-bsb">BSB</Label>
              <Input
                id="bank-bsb"
                placeholder="062-000"
                value={formData.bankBsb}
                onChange={(e) => setFormData({ ...formData, bankBsb: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-account-number">Account Number</Label>
              <Input
                id="bank-account-number"
                placeholder="12345678"
                value={formData.bankAccountNumber}
                onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-instructions">Payment Instructions (Optional)</Label>
            <Input
              id="payment-instructions"
              placeholder="Please use invoice number as payment reference"
              value={formData.paymentInstructions}
              onChange={(e) => setFormData({ ...formData, paymentInstructions: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Additional instructions that will appear on invoices
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => updateSettingsMutation.mutate()}
          disabled={updateSettingsMutation.isPending}
          size="lg"
        >
          {updateSettingsMutation.isPending ? "Saving..." : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
}
