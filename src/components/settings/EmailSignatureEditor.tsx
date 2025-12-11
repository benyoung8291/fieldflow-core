import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DOMPurify from "dompurify";

const PLACEHOLDERS = [
  { key: "{{first_name}}", label: "First Name", example: "John" },
  { key: "{{last_name}}", label: "Last Name", example: "Smith" },
  { key: "{{full_name}}", label: "Full Name", example: "John Smith" },
  { key: "{{email}}", label: "Email", example: "john@company.com" },
  { key: "{{phone}}", label: "Phone", example: "0400 000 000" },
  { key: "{{company_name}}", label: "Company Name", example: "ACME Corp" },
  { key: "{{job_title}}", label: "Job Title", example: "Account Manager" },
];

export function EmailSignatureEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [signature, setSignature] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current user profile with signature
  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile-signature"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, phone, email_signature, tenant_id")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch tenant info for company name
  const { data: tenant } = useQuery({
    queryKey: ["tenant-info", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;
      const { data, error } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", profile.tenant_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  useEffect(() => {
    if (profile?.email_signature !== undefined) {
      setSignature(profile.email_signature || "");
      setHasChanges(false);
    }
  }, [profile?.email_signature]);

  const saveMutation = useMutation({
    mutationFn: async (newSignature: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ email_signature: newSignature })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile-signature"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast({ title: "Signature saved successfully" });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save signature",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const insertPlaceholder = (placeholder: string) => {
    setSignature((prev) => prev + placeholder);
    setHasChanges(true);
  };

  const renderPreview = () => {
    if (!signature) return "<p class='text-muted-foreground italic'>No signature set</p>";

    let preview = signature;
    preview = preview.replace(/\{\{first_name\}\}/g, profile?.first_name || "John");
    preview = preview.replace(/\{\{last_name\}\}/g, profile?.last_name || "Smith");
    preview = preview.replace(/\{\{full_name\}\}/g, `${profile?.first_name || "John"} ${profile?.last_name || "Smith"}`);
    preview = preview.replace(/\{\{email\}\}/g, profile?.email || "john@company.com");
    preview = preview.replace(/\{\{phone\}\}/g, profile?.phone || "");
    preview = preview.replace(/\{\{company_name\}\}/g, tenant?.name || "Your Company");
    preview = preview.replace(/\{\{job_title\}\}/g, "");

    return DOMPurify.sanitize(preview);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Email Signature
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Your email signature will be automatically appended to emails you send from the helpdesk.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>
          Create your email signature with dynamic placeholders. HTML formatting is supported.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Placeholder badges */}
        <div className="space-y-2">
          <Label className="text-sm">Insert Placeholders</Label>
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDERS.map((p) => (
              <TooltipProvider key={p.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => insertPlaceholder(p.key)}
                    >
                      {p.label}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Click to insert: <code className="text-xs">{p.key}</code></p>
                    <p className="text-muted-foreground text-xs">Example: {p.example}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>

        {/* Signature editor */}
        <div className="space-y-2">
          <Label htmlFor="signature">Signature (HTML supported)</Label>
          <Textarea
            id="signature"
            value={signature}
            onChange={(e) => {
              setSignature(e.target.value);
              setHasChanges(true);
            }}
            placeholder={`<p>Best regards,</p>
<p><strong>{{full_name}}</strong><br/>
{{job_title}}<br/>
{{company_name}}</p>
<p>{{email}} | {{phone}}</p>`}
            className="min-h-[150px] font-mono text-sm"
          />
        </div>

        {/* Live preview */}
        <div className="space-y-2">
          <Label>Live Preview</Label>
          <div 
            className="p-4 rounded-lg border bg-muted/30 min-h-[100px]"
            dangerouslySetInnerHTML={{ __html: renderPreview() }}
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={() => saveMutation.mutate(signature)}
            disabled={saveMutation.isPending || !hasChanges}
          >
            {saveMutation.isPending ? "Saving..." : "Save Signature"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}