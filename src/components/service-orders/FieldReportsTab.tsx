import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface FieldReportsTabProps {
  serviceOrderId: string;
}

export default function FieldReportsTab({ serviceOrderId }: FieldReportsTabProps) {
  const navigate = useNavigate();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['field-reports', serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_reports')
        .select(`
          *,
          photos:field_report_photos(count)
        `)
        .eq('service_order_id', serviceOrderId)
        .order('service_date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading field reports...</div>;
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
        <p className="text-muted-foreground">No field reports yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Field reports are created by workers from appointments
        </p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'approved': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Field Reports ({reports.length})</h3>
      </div>

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card
            key={report.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/field-reports', { state: { selectedReportId: report.id } })}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{report.report_number}</span>
                    <Badge variant={getStatusColor(report.status)}>
                      {report.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{format(new Date(report.service_date), 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span>{report.worker_name}</span>
                    </div>
                  </div>

                  {report.work_description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {report.work_description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{report.photos?.[0]?.count || 0} photos</span>
                    {report.had_problem_areas && (
                      <Badge variant="outline" className="text-amber-600">
                        Problem Areas
                      </Badge>
                    )}
                    {report.had_incident && (
                      <Badge variant="outline" className="text-red-600">
                        Incident Reported
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}