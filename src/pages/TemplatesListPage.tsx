import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, ShoppingCart, Receipt, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/DashboardLayout";

export default function TemplatesListPage() {
  const navigate = useNavigate();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['pdf-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pdf_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'quote': return <FileText className="h-5 w-5" />;
      case 'invoice': return <Receipt className="h-5 w-5" />;
      case 'purchase_order': return <ShoppingCart className="h-5 w-5" />;
      case 'field_report': return <ClipboardList className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'quote': return 'Quote';
      case 'invoice': return 'Invoice';
      case 'purchase_order': return 'Purchase Order';
      case 'field_report': return 'Field Report';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Document Templates</h1>
              <p className="text-muted-foreground">Create beautiful templates for your documents</p>
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Document Templates</h1>
            <p className="text-muted-foreground">Create beautiful templates for your documents</p>
          </div>
          <Button onClick={() => navigate('/template-builder')}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates?.map((template) => (
            <Card 
              key={template.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/template-builder/${template.id}`)}
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  {getDocumentIcon(template.document_type)}
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{getDocumentTypeLabel(template.document_type)}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="aspect-[8.5/11] bg-muted rounded-lg flex items-center justify-center">
                  {template.thumbnail_url ? (
                    <img src={template.thumbnail_url} alt={template.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                {template.is_default && (
                  <div className="mt-3">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Default</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {(!templates || templates.length === 0) && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first template to generate beautiful documents
                </p>
                <Button onClick={() => navigate('/template-builder')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}