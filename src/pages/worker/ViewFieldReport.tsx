import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export default function ViewFieldReport() {
  const { appointmentId, reportId } = useParams();
  const navigate = useNavigate();

  const { data: report, isLoading } = useQuery({
    queryKey: ['field-report', reportId],
    enabled: !!reportId,
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
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['field-report-photos', reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_report_photos')
        .select('*')
        .eq('field_report_id', reportId)
        .order('display_order');

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading field report...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Field report not found</div>
        </div>
      </DashboardLayout>
    );
  }

  const beforePhotos = photos.filter(p => p.photo_type === 'before');
  const afterPhotos = photos.filter(p => p.photo_type === 'after');

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/appointments/${appointmentId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{report.report_number}</h1>
            <p className="text-muted-foreground">Field Report Details</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Worker</p>
                <p className="font-medium">{report.worker_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Service Date</p>
                <p className="font-medium">{format(new Date(report.service_date), "MMM d, yyyy")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Arrival Time</p>
                <p className="font-medium">{report.arrival_time}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{report.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Condition on Arrival</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Carpet Condition</p>
                <p className="font-medium">{report.carpet_condition_arrival}/5</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hard Floor Condition</p>
                <p className="font-medium">{report.hard_floor_condition_arrival}/5</p>
              </div>
            </div>
            {report.flooring_state_description && (
              <div>
                <p className="text-sm text-muted-foreground">Overall State</p>
                <p className="mt-1">{report.flooring_state_description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{report.work_description}</p>
          </CardContent>
        </Card>

        {report.internal_notes && (
          <Card>
            <CardHeader>
              <CardTitle>Internal Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{report.internal_notes}</p>
            </CardContent>
          </Card>
        )}

        {photos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-3">Before</h3>
                  <div className="space-y-3">
                    {beforePhotos.map((photo) => (
                      <div key={photo.id} className="space-y-2">
                        <img
                          src={photo.file_url}
                          alt="Before"
                          className="w-full rounded-lg border"
                        />
                        {photo.notes && (
                          <p className="text-sm text-muted-foreground">{photo.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-3">After</h3>
                  <div className="space-y-3">
                    {afterPhotos.map((photo) => (
                      <div key={photo.id} className="space-y-2">
                        <img
                          src={photo.file_url}
                          alt="After"
                          className="w-full rounded-lg border"
                        />
                        {photo.notes && (
                          <p className="text-sm text-muted-foreground">{photo.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
