import { useState } from "react";
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
  Image as ImageIcon,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PhotoLightbox } from "./PhotoLightbox";

interface FieldReportDetailProps {
  reportId: string;
}

export function FieldReportDetail({ reportId }: FieldReportDetailProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<any[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { data: report, isLoading } = useQuery({
    queryKey: ["field-report-detail", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_reports")
        .select(`
          *,
          location:customer_locations!field_reports_location_id_fkey(
            name,
            address, 
            city,
            state,
            postcode
          ),
          appointment:appointments(
            id,
            title,
            start_time,
            end_time,
            description,
            service_order:service_orders(
              id,
              work_order_number,
              description,
              location:customer_locations!service_orders_customer_location_id_fkey(name, address, city, state, postcode)
            )
          ),
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

  // Group photos into before/after pairs
  const photoPairs: Array<{ before?: any; after?: any }> = [];
  const beforePhotos = report.photos?.filter((p: any) => p.photo_type === 'before').sort((a: any, b: any) => a.display_order - b.display_order) || [];
  const afterPhotos = report.photos?.filter((p: any) => p.photo_type === 'after').sort((a: any, b: any) => a.display_order - b.display_order) || [];
  
  // Create pairs based on display_order
  const maxLength = Math.max(beforePhotos.length, afterPhotos.length);
  for (let i = 0; i < maxLength; i++) {
    photoPairs.push({
      before: beforePhotos[i],
      after: afterPhotos[i]
    });
  }

  const openLightbox = (photos: any[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        {/* Report Header */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border-l-4 border-primary rounded-lg p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Field Service Report
                </h1>
                <Badge className="rounded-full px-4 py-1.5 bg-success text-success-foreground border-success shadow-sm">
                  ✓ Approved
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">
                  Report #{report.report_number}
                </p>
                {report.appointment?.title && (
                  <p className="text-base text-muted-foreground">{report.appointment.title}</p>
                )}
              </div>
            </div>
            {report.pdf_url && (
              <Button
                onClick={() => window.open(report.pdf_url, '_blank')}
                size="lg"
                className="rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            )}
          </div>
        </div>

        {/* Service Information Grid */}
        <Card className="border-border/40">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-xl font-semibold">Service Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Service Date</p>
                  <p className="text-base font-semibold">
                    {new Date(report.service_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-info/10 p-3">
                  <Clock className="h-5 w-5 text-info" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Arrival Time</p>
                  <p className="text-base font-semibold">
                    {(() => {
                      // Combine service_date and arrival_time to create a valid Date
                      const dateStr = report.service_date;
                      const timeStr = report.arrival_time;
                      const dateTime = new Date(`${dateStr}T${timeStr}`);
                      return dateTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      });
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-warning/10 p-3">
                  <MapPin className="h-5 w-5 text-warning" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Service Location</p>
                  <p className="text-base font-semibold">
                    {report.location?.name || report.appointment?.service_order?.location?.name || 'N/A'}
                  </p>
                  {(report.location?.address || report.appointment?.service_order?.location?.address) && (
                    <p className="text-sm text-muted-foreground">
                      {report.location?.address || report.appointment.service_order.location.address}
                      {(report.location?.city || report.appointment?.service_order?.location?.city) && (
                        <>, {report.location?.city || report.appointment.service_order.location.city} {report.location?.state || report.appointment.service_order.location.state} {report.location?.postcode || report.appointment.service_order.location.postcode}</>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-success/10 p-3">
                  <User className="h-5 w-5 text-success" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Service Technician</p>
                  <p className="text-base font-semibold">{report.worker_name}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Description */}
        <Card className="border-border/40">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-xl font-semibold">Work Performed</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="prose prose-sm max-w-none">
              <p className="text-base leading-relaxed whitespace-pre-wrap">{report.work_description}</p>
            </div>
            
            {report.methods_attempted && (
              <>
                <Separator />
                <div>
                  <h4 className="text-base font-semibold mb-3">Methods & Techniques Applied</h4>
                  <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {report.methods_attempted}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Condition Ratings */}
        <Card className="border-border/40">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-xl font-semibold">Condition Assessment</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-8 md:grid-cols-2">
              {report.carpet_condition_arrival !== null && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium">Carpet Condition</span>
                    <Badge variant="outline" className="rounded-full text-base px-3 py-1">
                      {report.carpet_condition_arrival}/10
                    </Badge>
                  </div>
                  <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all rounded-full shadow-sm",
                        report.carpet_condition_arrival >= 7 ? "bg-success" :
                        report.carpet_condition_arrival >= 4 ? "bg-warning" : "bg-destructive"
                      )}
                      style={{ width: `${(report.carpet_condition_arrival / 10) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {report.hard_floor_condition_arrival !== null && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium">Hard Floor Condition</span>
                    <Badge variant="outline" className="rounded-full text-base px-3 py-1">
                      {report.hard_floor_condition_arrival}/10
                    </Badge>
                  </div>
                  <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all rounded-full shadow-sm",
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
              <div className="md:col-span-2 mt-2">
                <Separator className="mb-4" />
                <h4 className="text-base font-semibold mb-3">Additional Notes</h4>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-base leading-relaxed text-muted-foreground">
                    {report.flooring_state_description}
                  </p>
                </div>
              </div>
            )}
        </CardContent>
      </Card>

        {/* Safety & Equipment */}
        <Card className="border-border/40">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-xl font-semibold">Safety & Equipment Compliance</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                report.has_signed_swms 
                  ? "bg-success/5 border-success/20" 
                  : "bg-destructive/5 border-destructive/20"
              )}>
                {report.has_signed_swms ? (
                  <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive flex-shrink-0" />
                )}
                <span className="text-base font-medium">SWMS Signed</span>
              </div>

              <div className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                report.equipment_tested_tagged 
                  ? "bg-success/5 border-success/20" 
                  : "bg-destructive/5 border-destructive/20"
              )}>
                {report.equipment_tested_tagged ? (
                  <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive flex-shrink-0" />
                )}
                <span className="text-base font-medium">Equipment Tagged</span>
              </div>

              <div className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                report.equipment_clean_working 
                  ? "bg-success/5 border-success/20" 
                  : "bg-destructive/5 border-destructive/20"
              )}>
                {report.equipment_clean_working ? (
                  <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive flex-shrink-0" />
                )}
                <span className="text-base font-medium">Equipment Clean</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issues */}
        {(report.had_problem_areas || report.had_incident) && (
          <Card className="border-2 border-warning/40 bg-warning/5">
            <CardHeader className="border-b border-warning/20 bg-warning/10">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-warning/20 p-2">
                  <AlertCircle className="h-6 w-6 text-warning" />
                </div>
                <CardTitle className="text-xl font-semibold">Reported Issues</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {report.had_problem_areas && report.problem_areas_description && (
                <div>
                  <h4 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-warning" />
                    Problem Areas Identified
                  </h4>
                  <div className="p-4 bg-background/50 rounded-lg border border-warning/20">
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {report.problem_areas_description}
                    </p>
                  </div>
                </div>
              )}

              {report.had_incident && report.incident_description && (
                <div>
                  <Separator className="bg-warning/20" />
                  <h4 className="text-base font-semibold mb-3 text-destructive flex items-center gap-2 mt-6">
                    <div className="h-2 w-2 rounded-full bg-destructive" />
                    Incident Report
                  </h4>
                  <div className="p-4 bg-destructive/5 rounded-lg border-2 border-destructive/20">
                    <p className="text-base leading-relaxed whitespace-pre-wrap">
                      {report.incident_description}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {photoPairs.length > 0 && (
          <Card className="border-border/40">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <ImageIcon className="h-6 w-6 text-primary" />
                <CardTitle className="text-xl font-semibold">Service Photos</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Before and after comparison - Click on any photo to view in full size with zoom
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {photoPairs.map((pair, pairIndex) => (
                <div key={pairIndex} className="space-y-4">
                  {pairIndex > 0 && <Separator className="my-6" />}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Before Photo */}
                    {pair.before ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-px flex-1 bg-gradient-to-r from-info/50 to-transparent" />
                          <h4 className="text-base font-semibold flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-info shadow-sm" />
                            Before Service
                          </h4>
                          <div className="h-px flex-1 bg-gradient-to-l from-info/50 to-transparent" />
                        </div>
                        <button
                          onClick={() => openLightbox([pair.before], 0)}
                          className="group relative aspect-square rounded-xl overflow-hidden border-2 border-border/40 hover:border-info/50 transition-all hover:scale-[1.02] hover:shadow-lg w-full"
                        >
                          <img
                            src={pair.before.file_url}
                            alt="Before service"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white/90 backdrop-blur-sm rounded-full p-3">
                              <ImageIcon className="h-5 w-5 text-foreground" />
                            </div>
                          </div>
                          {pair.before.notes && (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                              <p className="text-xs text-white line-clamp-2 font-medium">{pair.before.notes}</p>
                            </div>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center aspect-square rounded-xl border-2 border-dashed border-border/40 bg-muted/20">
                        <p className="text-sm text-muted-foreground">No before photo</p>
                      </div>
                    )}

                    {/* After Photo */}
                    {pair.after ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-px flex-1 bg-gradient-to-r from-success/50 to-transparent" />
                          <h4 className="text-base font-semibold flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-success shadow-sm" />
                            After Service
                          </h4>
                          <div className="h-px flex-1 bg-gradient-to-l from-success/50 to-transparent" />
                        </div>
                        <button
                          onClick={() => openLightbox([pair.after], 0)}
                          className="group relative aspect-square rounded-xl overflow-hidden border-2 border-border/40 hover:border-success/50 transition-all hover:scale-[1.02] hover:shadow-lg w-full"
                        >
                          <img
                            src={pair.after.file_url}
                            alt="After service"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white/90 backdrop-blur-sm rounded-full p-3">
                              <ImageIcon className="h-5 w-5 text-foreground" />
                            </div>
                          </div>
                          {pair.after.notes && (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                              <p className="text-xs text-white line-clamp-2 font-medium">{pair.after.notes}</p>
                            </div>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center aspect-square rounded-xl border-2 border-dashed border-border/40 bg-muted/20">
                        <p className="text-sm text-muted-foreground">No after photo</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Technician Signature */}
        {report.customer_signature_data && (
          <Card className="border-border/40">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-xl font-semibold">Technician Sign-Off</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="border-2 border-border/40 rounded-xl p-6 bg-background shadow-sm">
                  <img
                    src={report.customer_signature_data}
                    alt="Customer Signature"
                    className="max-h-32 w-auto"
                  />
                </div>
                <div className="flex-1 space-y-4">
                  {report.customer_signature_name && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Signed by</p>
                      <p className="text-lg font-semibold">{report.customer_signature_name}</p>
                    </div>
                  )}
                  {report.customer_signature_date && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Date signed</p>
                      <p className="text-base">
                        {new Date(report.customer_signature_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground italic">
                      This signature confirms the technician has completed the service work as described.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
