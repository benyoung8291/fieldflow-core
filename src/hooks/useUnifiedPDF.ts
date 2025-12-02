// Hook for unified PDF generation

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { generateUnifiedPDF, getDefaultTemplate } from "@/lib/pdf";
import type { DocumentData, LineItem, CompanySettings, UnifiedTemplate, DocumentType } from "@/lib/pdf/types";

export function useUnifiedPDF() {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const downloadPDF = async (
    documentType: DocumentType,
    documentData: DocumentData,
    lineItems: LineItem[],
    filename?: string
  ) => {
    setGenerating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Fetch company settings from tenants table
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", profile.tenant_id)
        .single();

      const companySettings: CompanySettings = {
        company_name: (tenantData as any)?.company_name || "",
        logo_url: (tenantData as any)?.logo_url || undefined,
        address: (tenantData as any)?.address || "",
        city: (tenantData as any)?.city || "",
        state: (tenantData as any)?.state || "",
        postcode: (tenantData as any)?.postcode || "",
        phone: (tenantData as any)?.phone || "",
        email: (tenantData as any)?.email || "",
        website: (tenantData as any)?.website || "",
        abn: (tenantData as any)?.abn || "",
        default_tax_rate: (tenantData as any)?.default_tax_rate || 10,
      };

      // Fetch template or use default
      const { data: templateData } = await supabase
        .from("pdf_templates")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("document_type", documentType)
        .eq("is_default", true)
        .maybeSingle();

      let template: UnifiedTemplate = templateData
        ? {
            id: templateData.id,
            name: templateData.name,
            document_type: templateData.document_type as DocumentType,
            field_mappings: (templateData.field_mappings as any) || {},
            line_items_config: (templateData.line_items_config as any) || getDefaultTemplate(documentType).line_items_config,
            content_zones: (templateData.content_zones as any) || getDefaultTemplate(documentType).content_zones,
            page_settings: (templateData.page_settings as any) || getDefaultTemplate(documentType).page_settings,
          }
        : getDefaultTemplate(documentType);

      const blob = await generateUnifiedPDF({
        template,
        documentData,
        lineItems,
        companySettings,
        documentType,
      });

      const defaultFilename = `${documentType.replace('_', '-')}-${documentData.document_number || 'document'}.pdf`;
      saveAs(blob, filename || defaultFilename);

      toast({
        title: "PDF Generated",
        description: "Your document has been downloaded.",
      });
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return { downloadPDF, generating };
}
