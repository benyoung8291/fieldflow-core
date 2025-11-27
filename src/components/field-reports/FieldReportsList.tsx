import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Edit, Eye } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface FieldReportsListProps {
  appointmentId: string;
  onReportStateChange?: () => void;
}

export default function FieldReportsList({ appointmentId, onReportStateChange }: FieldReportsListProps) {
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: fieldReports = [], isLoading } = useQuery({
    queryKey: ['field-reports', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_reports')
        .select(`
          *,
          profiles:created_by (
            first_name,
            last_name
          )
        `)
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Loading field reports...
      </div>
    );
  }

  if (fieldReports.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No field reports yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fieldReports.map((report: any) => {
        const isCreator = currentUser?.id === report.created_by;
        const isLocked = report.approved_at && report.pdf_url;
        const canEdit = isCreator && !isLocked;

        return (
          <Card key={report.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{report.report_number}</h4>
                    <Badge 
                      variant={report.status === 'submitted' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {report.status}
                    </Badge>
                    {isLocked && (
                      <Badge variant="outline" className="text-xs">
                        Approved
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    By {report.profiles?.first_name} {report.profiles?.last_name}
                  </p>
                  {report.created_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(report.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                  {report.submitted_at && (
                    <p className="text-xs text-muted-foreground">
                      Submitted: {format(new Date(report.submitted_at), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/worker/field-report/${appointmentId}/edit/${report.id}`)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/worker/field-report/${appointmentId}/view/${report.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
