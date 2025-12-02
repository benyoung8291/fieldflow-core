import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export default function ViewFieldReport() {
  const { appointmentId, reportId } = useParams();
  const navigate = useNavigate();

  console.log('ViewFieldReport - reportId:', reportId, 'appointmentId:', appointmentId);

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['field-report-view', reportId],
    enabled: !!reportId,
    staleTime: 0,
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

      if (error) {
        console.error('Field report fetch error:', error);
        throw error;
      }
      console.log('Field report fetched successfully:', data);
      return data;
    },
  });

  const { data: photos = [], error: photosError } = useQuery({
    queryKey: ['field-report-photos-view', reportId],
    enabled: !!reportId && !!report,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_report_photos')
        .select('*')
        .eq('field_report_id', reportId)
        .order('display_order');

      if (error) {
        console.error('Field report photos fetch error:', error);
        throw error;
      }
      console.log('Field report photos fetched:', data?.length || 0, 'photos');
      return data;
    },
  });

  if (error) {
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
            <h1 className="text-lg font-bold">Field Report</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 gap-4">
          <div className="text-destructive text-center">
            <p className="font-semibold">Error loading field report</p>
            <p className="text-sm mt-2">{error.message}</p>
          </div>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

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
            <h1 className="text-lg font-bold">Field Report</h1>
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
            <h1 className="text-lg font-bold">Field Report</h1>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Field report not found</div>
        </div>
      </div>
    );
  }

  const beforePhotos = photos.filter(p => p.photo_type === 'before');
  const afterPhotos = photos.filter(p => p.photo_type === 'after');

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
          <h1 className="text-lg font-bold">Field Report</h1>
        </div>
      </header>

      <div className="space-y-6 max-w-4xl mx-auto p-6">
        <div>
          <h2 className="text-2xl font-bold">{report.report_number}</h2>
          <p className="text-muted-foreground">Field Report Details</p>
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
    </div>
  );
}
