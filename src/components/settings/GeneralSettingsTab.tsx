import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

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
  });

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
      });
    }
  }, [settings]);

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
      };

      if (settings) {
        // Update existing settings
        const { error } = await supabase
          .from("tenant_settings" as any)
          .update(updateData)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Create new settings
        const { error } = await supabase
          .from("tenant_settings" as any)
          .insert({
            tenant_id: profile.tenant_id,
            ...updateData,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
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
            <Input
              id="address-line-1"
              placeholder="123 Main Street"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
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
            <Label htmlFor="logo-url">Logo URL</Label>
            <Input
              id="logo-url"
              type="url"
              placeholder="https://example.com/logo.png"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Upload your logo to a hosting service and paste the URL here
            </p>
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
