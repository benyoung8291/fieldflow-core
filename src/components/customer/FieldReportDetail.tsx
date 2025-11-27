import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Calendar, 
  MapPin, 
  User, 
  Clock,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldReportDetailProps {
  reportId: string;
}

export function FieldReportDetail({ reportId }: FieldReportDetailProps) {
  const { data: report, isLoading } = useQuery({
    queryKey: ["field-report-detail", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_reports")
        .select(`
          *,
          appointment:appointments(
            id,
            title,
            start_time,
            end_time,
            description,
            service_order:service_orders(
              id,
              order_number,
              description,
              location:customer_locations!service_orders_customer_location_id_fkey(name, address, city, state, postcode)
            )
          ),
          created_by_profile:profiles(first_name, last_name, email),
          photos:field_report_photos(
            id,
            file_url,
            photo_type,
            notes,
            display_order
          )
        `)
        .eq("id", reportId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Report not found</p>
        </CardContent>
      </Card>
    );
  }

  const beforePhotos = report.photos?.filter((p: any) => p.photo_type === 'before').sort((a: any, b: any) => a.display_order - b.display_order) || [];
  const afterPhotos = report.photos?.filter((p: any) => p.photo_type === 'after').sort((a: any, b: any) => a.display_order - b.display_order) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Card */}
      <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/50 backdrop-blur-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <CardHeader className="relative">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-2xl md:text-3xl">Report #{report.report_number}</CardTitle>
                <Badge className="rounded-full px-3 py-1 bg-success/10 text-success border-success/20">
                  Approved
                </Badge>
              </div>
              {report.appointment?.title && (
                <p className="text-muted-foreground">{report.appointment.title}</p>
              )}
            </div>
            {report.pdf_url && (
              <Button
                onClick={() => window.open(report.pdf_url, '_blank')}
                className="rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Key Information */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Service Date</p>
                <p className="text-sm font-semibold">
                  {new Date(report.service_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-info/10 p-2">
                <Clock className="h-4 w-4 text-info" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Arrival Time</p>
                <p className="text-sm font-semibold">
                  {new Date(report.arrival_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-warning/10 p-2">
                <MapPin className="h-4 w-4 text-warning" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-semibold line-clamp-2">
                  {report.appointment?.service_order?.location?.name || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-success/10 p-2">
                <User className="h-4 w-4 text-success" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Technician</p>
                <p className="text-sm font-semibold">{report.worker_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Work Description */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Work Performed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{report.work_description}</p>
          </div>
          
          {report.methods_attempted && (
            <div className="pt-4 border-t border-border/40">
              <h4 className="text-sm font-semibold mb-2">Methods Applied</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.methods_attempted}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Condition Ratings */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Condition Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {report.carpet_condition_arrival !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Carpet Condition</span>
                  <Badge variant="outline" className="rounded-full">
                    {report.carpet_condition_arrival}/10
                  </Badge>
                </div>
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all rounded-full",
                      report.carpet_condition_arrival >= 7 ? "bg-success" :
                      report.carpet_condition_arrival >= 4 ? "bg-warning" : "bg-destructive"
                    )}
                    style={{ width: `${(report.carpet_condition_arrival / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {report.hard_floor_condition_arrival !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Hard Floor Condition</span>
                  <Badge variant="outline" className="rounded-full">
                    {report.hard_floor_condition_arrival}/10
                  </Badge>
                </div>
                <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all rounded-full",
                      report.hard_floor_condition_arrival >= 7 ? "bg-success" :
                      report.hard_floor_condition_arrival >= 4 ? "bg-warning" : "bg-destructive"
                    )}
                    style={{ width: `${(report.hard_floor_condition_arrival / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {report.flooring_state_description && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">{report.flooring_state_description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safety & Equipment */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Safety & Equipment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              {report.has_signed_swms ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="text-sm">SWMS Signed</span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              {report.equipment_tested_tagged ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="text-sm">Equipment Tagged</span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              {report.equipment_clean_working ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <span className="text-sm">Equipment Clean</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues */}
      {(report.had_problem_areas || report.had_incident) && (
        <Card className="border-border/40 bg-warning/5 border-warning/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              <CardTitle className="text-lg">Reported Issues</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.had_problem_areas && report.problem_areas_description && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Problem Areas</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {report.problem_areas_description}
                </p>
              </div>
            )}

            {report.had_incident && report.incident_description && (
              <div className="pt-4 border-t border-warning/20">
                <h4 className="text-sm font-semibold mb-2 text-warning">Incident Report</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {report.incident_description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Photos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {beforePhotos.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-info" />
                  Before Photos
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {beforePhotos.map((photo: any) => (
                    <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border/40 hover-lift">
                      <img
                        src={photo.file_url}
                        alt="Before"
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      {photo.notes && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-xs text-white line-clamp-2">{photo.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {afterPhotos.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-success" />
                  After Photos
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {afterPhotos.map((photo: any) => (
                    <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden border border-border/40 hover-lift">
                      <img
                        src={photo.file_url}
                        alt="After"
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      {photo.notes && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-xs text-white line-clamp-2">{photo.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Customer Signature */}
      {report.customer_signature_data && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Customer Approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="border border-border/40 rounded-lg p-4 bg-background/50">
                <img
                  src={report.customer_signature_data}
                  alt="Customer Signature"
                  className="max-h-32"
                />
              </div>
              <div className="flex-1 space-y-2">
                {report.customer_signature_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Signed by</p>
                    <p className="text-sm font-semibold">{report.customer_signature_name}</p>
                  </div>
                )}
                {report.customer_signature_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm">
                      {new Date(report.customer_signature_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
