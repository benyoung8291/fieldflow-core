import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import FieldReportForm from "@/components/field-reports/FieldReportForm";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function EditFieldReport() {
  const { appointmentId, reportId } = useParams();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['field-report', reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20 pt-14">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading field report...</div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background pb-20 pt-14">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Field report not found</div>
        </div>
      </div>
    );
  }

  // Check permissions
  const isCreator = currentUser?.id === report.created_by;
  const isLocked = report.approved_at && report.pdf_url;

  if (!isCreator) {
    return (
      <div className="min-h-screen bg-background pb-20 pt-14">
        <div className="max-w-2xl mx-auto p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You can only edit field reports that you created.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate(`/worker/appointments/${appointmentId}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Appointment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-2xl mx-auto p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This field report has been approved and cannot be edited.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => navigate(`/worker/appointments/${appointmentId}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Appointment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 pt-14">
      <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-md border-b border-border/50 p-4 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/worker/appointments/${appointmentId}`)}
          className="mb-2 h-10 w-10 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Edit Field Report</h1>
      </div>

      <FieldReportForm
        appointmentId={appointmentId}
        reportId={reportId}
        onSave={() => navigate(`/worker/appointments/${appointmentId}`)}
      />
    </div>
  );
}
