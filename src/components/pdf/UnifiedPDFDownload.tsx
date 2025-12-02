// Unified PDF Download Component

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { generateUnifiedPDF, getDefaultTemplate } from "@/lib/pdf";
import type { DocumentData, LineItem, CompanySettings, UnifiedTemplate, DocumentType } from "@/lib/pdf/types";

interface UnifiedPDFDownloadProps {
  documentType: DocumentType;
  documentData: DocumentData;
  lineItems: LineItem[];
  filename?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
}

export const UnifiedPDFDownload: React.FC<UnifiedPDFDownloadProps> = ({
  documentType,
  documentData,
  lineItems,
  filename,
  className,
  variant = "outline",
  size = "default",
  children,
}) => {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setGenerating(true);
    
    try {
      // Fetch company settings
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data: companyData } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", profile.tenant_id)
        .single();

      const companySettings: CompanySettings = {
        company_name: (companyData as any)?.company_name || "",
        logo_url: (companyData as any)?.logo_url || undefined,
        address: (companyData as any)?.address || "",
        city: (companyData as any)?.city || "",
        state: (companyData as any)?.state || "",
        postcode: (companyData as any)?.postcode || "",
        phone: (companyData as any)?.phone || "",
        email: (companyData as any)?.email || "",
        website: (companyData as any)?.website || "",
        abn: (companyData as any)?.abn || "",
        default_tax_rate: (companyData as any)?.default_tax_rate || 10,
      };

      // Try to fetch a custom template, fall back to default
      const { data: templateData } = await supabase
        .from("pdf_templates")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("document_type", documentType)
        .eq("is_default", true)
        .maybeSingle();

      let template: UnifiedTemplate;
      
      if (templateData) {
        template = {
          id: templateData.id,
          name: templateData.name,
          document_type: templateData.document_type as DocumentType,
          template_json: templateData.template_json,
          template_image_url: templateData.template_image_url || undefined,
          field_mappings: (templateData.field_mappings as Record<string, any>) || {},
          line_items_config: (templateData.line_items_config as any) || getDefaultTemplate(documentType).line_items_config,
          header_config: templateData.header_config,
          footer_config: templateData.footer_config,
          content_zones: (templateData.content_zones as any) || getDefaultTemplate(documentType).content_zones,
          page_settings: (templateData.page_settings as any) || getDefaultTemplate(documentType).page_settings,
          is_default: templateData.is_default || false,
        };
      } else {
        template = getDefaultTemplate(documentType);
      }

      // Generate PDF
      const blob = await generateUnifiedPDF({
        template,
        documentData,
        lineItems,
        companySettings,
        documentType,
      });

      // Generate filename
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

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={generating}
      className={className}
    >
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {children || "Download PDF"}
    </Button>
  );
};

export default UnifiedPDFDownload;
