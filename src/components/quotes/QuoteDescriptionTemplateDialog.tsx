import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QuoteDescriptionTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDescription: string;
  onSelectDescription: (description: string) => void;
  tenantId: string;
}

export default function QuoteDescriptionTemplateDialog({
  open,
  onOpenChange,
  currentDescription,
  onSelectDescription,
  tenantId: propTenantId,
}: QuoteDescriptionTemplateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState("");

  // Fetch tenant ID when dialog opens
  useEffect(() => {
    const fetchTenantId = async () => {
      if (open && !tenantId) {
        console.log('[QuoteDescriptionTemplateDialog] Fetching tenant ID...');
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[QuoteDescriptionTemplateDialog] User:', user?.id);
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tenant_id")
            .eq("id", user.id)
            .single();
          
          console.log('[QuoteDescriptionTemplateDialog] Profile data:', profile);
          if (profile) {
            console.log('[QuoteDescriptionTemplateDialog] Setting tenant ID:', profile.tenant_id);
            setTenantId(profile.tenant_id);
          }
        }
      }
    };
    fetchTenantId();
  }, [open]);

  // Fetch templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["quote-description-templates", tenantId],
    queryFn: async () => {
      console.log('[QuoteDescriptionTemplateDialog] Fetching templates for tenant:', tenantId);
      const { data, error } = await supabase
        .from("quote_description_templates")
        .select("*, profiles:created_by(first_name, last_name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      
      console.log('[QuoteDescriptionTemplateDialog] Templates query result:', { data, error });
      if (error) throw error;
      return data;
    },
    enabled: open && !!tenantId,
  });

  // Fetch other quotes for copying
  const { data: otherQuotes = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ["quotes-for-description-copy", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, title, description, created_at, customers(name), leads(name)")
        .eq("tenant_id", tenantId)
        .not("description", "is", null)
        .neq("description", "")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!tenantId,
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("quote_description_templates")
        .insert([{
          tenant_id: tenantId,
          name,
          description: currentDescription,
          created_by: user.id,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-description-templates"] });
      toast({ title: "Template saved successfully" });
      setTemplateName("");
    },
    onError: (error: any) => {
      toast({
        title: "Error saving template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("quote_description_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quote-description-templates"] });
      toast({ title: "Template deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Template name required",
        description: "Please enter a name for the template",
        variant: "destructive",
      });
      return;
    }

    if (!currentDescription.trim()) {
      toast({
        title: "No description to save",
        description: "Please enter a description before saving as template",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    await saveTemplateMutation.mutateAsync(templateName);
    setSaving(false);
  };

  const handleLoadTemplate = (description: string) => {
    onSelectDescription(description);
    onOpenChange(false);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      await deleteTemplateMutation.mutateAsync(templateId);
    }
  };

  const getCurrentUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Description Templates & Quotes</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="templates">My Templates</TabsTrigger>
            <TabsTrigger value="quotes">Copy from Quotes</TabsTrigger>
            <TabsTrigger value="save">Save New Template</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <ScrollArea className="h-[400px]">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No templates saved yet. Create one in the "Save New Template" tab.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template: any) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>{template.profiles ? `${template.profiles.first_name || ''} ${template.profiles.last_name || ''}`.trim() : "Unknown"}</TableCell>
                        <TableCell>{new Date(template.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadTemplate(template.description)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Use
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={deleteTemplateMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="quotes" className="space-y-4">
            <ScrollArea className="h-[400px]">
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : otherQuotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No other quotes with descriptions found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote Title</TableHead>
                      <TableHead>Customer/Lead</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherQuotes.map((quote: any) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium">{quote.title}</TableCell>
                        <TableCell>
                          {quote.customers?.name || quote.leads?.name || "N/A"}
                        </TableCell>
                        <TableCell>{new Date(quote.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadTemplate(quote.description)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="save" className="space-y-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name..."
                />
              </div>

              <div className="space-y-2">
                <Label>Current Description Preview</Label>
                <ScrollArea className="h-[200px] border rounded-md p-4">
                  <div 
                    dangerouslySetInnerHTML={{ __html: currentDescription || "<i>No description entered yet</i>" }}
                    className="prose prose-sm max-w-none"
                  />
                </ScrollArea>
              </div>

              <Button
                onClick={handleSaveTemplate}
                disabled={saving || !templateName.trim() || !currentDescription.trim()}
                className="w-full"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Template
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
