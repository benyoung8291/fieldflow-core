import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TemplateBuilderCanvas } from "@/components/template-builder/TemplateBuilderCanvas";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function TemplateBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSave = async (json: string, thumbnail: string, name: string, documentType: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      if (id) {
        // Update existing template
        const { error } = await supabase
          .from("pdf_templates")
          .update({
            name,
            document_type: documentType,
            template_json: JSON.parse(json),
            thumbnail_url: thumbnail,
            updated_at: new Date().toISOString()
          })
          .eq("id", id);

        if (error) throw error;
      } else {
        // Create new template
        const { error } = await supabase
          .from("pdf_templates")
          .insert({
            tenant_id: profile.tenant_id,
            name,
            document_type: documentType,
            template_json: JSON.parse(json),
            thumbnail_url: thumbnail,
            created_by: user.id
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Template saved successfully",
      });

      navigate("/settings/templates");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return <TemplateBuilderCanvas templateId={id} onSave={handleSave} />;
}