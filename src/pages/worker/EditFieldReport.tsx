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
      <div className="min-h-screen bg-background pb-32">
        <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/worker/appointments/${appointmentId}`)}
              className="h-9 w-9 rounded-full text-primary-foreground hover:bg-primary-foreground/20 -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold">Edit Field Report</h1>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading field report...</div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/worker/appointments/${appointmentId}`)}
              className="h-9 w-9 rounded-full text-primary-foreground hover:bg-primary-foreground/20 -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold">Edit Field Report</h1>
          </div>
        </header>
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
      <div className="min-h-screen bg-background pb-32">
        <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/worker/appointments/${appointmentId}`)}
              className="h-9 w-9 rounded-full text-primary-foreground hover:bg-primary-foreground/20 -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold">Edit Field Report</h1>
          </div>
        </header>
        <div className="p-4">
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
      <div className="min-h-screen bg-background pb-32">
        <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/worker/appointments/${appointmentId}`)}
              className="h-9 w-9 rounded-full text-primary-foreground hover:bg-primary-foreground/20 -ml-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold">Edit Field Report</h1>
          </div>
        </header>
        <div className="p-4">
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
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/worker/appointments/${appointmentId}`)}
            className="h-9 w-9 rounded-full text-primary-foreground hover:bg-primary-foreground/20 -ml-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold">Edit Field Report</h1>
        </div>
      </header>

      <FieldReportForm
        appointmentId={appointmentId}
        reportId={reportId}
        onSave={() => navigate(`/worker/appointments/${appointmentId}`)}
      />
    </div>
  );
}
