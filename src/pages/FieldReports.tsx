import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Download, Edit, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import FieldReportDialog from '@/components/field-reports/FieldReportDialog';

export default function FieldReports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['field-reports'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('field_reports')
        .select(`
          *,
          customer:customers(name),
          location:customer_locations(name, address),
          appointment:appointments(title),
          service_order:service_orders(work_order_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: selectedReport } = useQuery({
    queryKey: ['field-report', selectedReportId],
    queryFn: async () => {
      if (!selectedReportId) return null;

      const { data, error } = await supabase
        .from('field_reports')
        .select(`
          *,
          customer:customers(name),
          location:customer_locations(name, address),
          appointment:appointments(title),
          service_order:service_orders(work_order_number),
          photos:field_report_photos(*)
        `)
        .eq('id', selectedReportId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedReportId,
  });

  const handleGeneratePDF = async () => {
    try {
      toast.info('Generating PDF...');
      
      const { data, error } = await supabase.functions.invoke('generate-field-report-pdf', {
        body: { report_id: selectedReportId },
      });

      if (error) throw error;

      // Download the PDF if a URL is returned
      if (data?.pdf_url) {
        const link = document.createElement('a');
        link.href = data.pdf_url;
        link.download = `field-report-${selectedReport?.report_number}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('PDF downloaded successfully');
      } else {
        toast.success('PDF generated successfully');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleApproveReport = async () => {
    if (!selectedReportId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('field_reports')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq('id', selectedReportId);

      if (error) throw error;

      toast.success('Report approved successfully');
      // Refresh reports list
      window.location.reload();
    } catch (error) {
      console.error('Error approving report:', error);
      toast.error('Failed to approve report');
    }
  };

  const filteredReports = reports?.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    return (
      report.report_number.toLowerCase().includes(searchLower) ||
      report.worker_name.toLowerCase().includes(searchLower) ||
      report.customer?.name.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'approved': return 'default';
      default: return 'secondary';
    }
  };

  const beforePhotos = selectedReport?.photos?.filter((p: any) => p.photo_type === 'before') || [];
  const afterPhotos = selectedReport?.photos?.filter((p: any) => p.photo_type === 'after') || [];

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-2xl font-bold">Field Reports</h1>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Report
          </Button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Panel - Reports List */}
        <div className="w-full lg:w-96 border-r bg-background flex flex-col">
          <div className="p-4 border-b space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Field Reports</h2>
              <Badge variant="secondary">{reports?.length || 0}</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Loading reports...
              </div>
            ) : filteredReports?.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No reports found
              </div>
            ) : (
              <div className="divide-y">
                {filteredReports?.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setEditMode(false);
                    }}
                    className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                      selectedReportId === report.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{report.report_number}</span>
                        </div>
                        <Badge variant={getStatusColor(report.status)}>
                          {report.status}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{report.customer?.name}</p>
                        <p className="text-muted-foreground">{report.worker_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(report.service_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Report Details */}
        <div className="flex-1 overflow-y-auto">
          {!selectedReport ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <FileText className="h-12 w-12 mx-auto opacity-20" />
                <p>Select a report to view details</p>
              </div>
            </div>
          ) : (
            <div className="p-6 max-w-4xl mx-auto space-y-6">
              {/* Header Actions */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{selectedReport.report_number}</h1>
                  <p className="text-muted-foreground">
                    {format(new Date(selectedReport.service_date), 'MMMM dd, yyyy')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {editMode ? 'View' : 'Edit'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleGeneratePDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Generate PDF
                  </Button>
                  {selectedReport.status !== 'approved' && (
                    <Button size="sm" onClick={handleApproveReport}>
                      Approve Report
                    </Button>
                  )}
                </div>
              </div>

              {/* Report Content */}
              <Card>
                <CardContent className="p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Worker</Label>
                      <p className="font-medium">{selectedReport.worker_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Customer</Label>
                      <p className="font-medium">{selectedReport.customer?.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Location</Label>
                      <p className="text-sm">{selectedReport.location?.address}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Arrival Time</Label>
                      <p className="font-medium">{selectedReport.arrival_time}</p>
                    </div>
                  </div>

                  {/* Condition Ratings */}
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="font-semibold">Condition on Arrival</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Carpet Condition</Label>
                        <p className="text-2xl font-bold">{selectedReport.carpet_condition_arrival}/5</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Hard Floor Condition</Label>
                        <p className="text-2xl font-bold">{selectedReport.hard_floor_condition_arrival}/5</p>
                      </div>
                    </div>
                    {selectedReport.flooring_state_description && (
                      <div>
                        <Label className="text-muted-foreground">Overall State</Label>
                        {editMode ? (
                          <Textarea value={selectedReport.flooring_state_description} rows={3} />
                        ) : (
                          <p className="text-sm">{selectedReport.flooring_state_description}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Safety Checks */}
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="font-semibold">Safety Checks</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedReport.has_signed_swms ? 'default' : 'secondary'}>
                          {selectedReport.has_signed_swms ? '✓' : '✗'}
                        </Badge>
                        <span className="text-sm">Signed SWMS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedReport.equipment_tested_tagged ? 'default' : 'secondary'}>
                          {selectedReport.equipment_tested_tagged ? '✓' : '✗'}
                        </Badge>
                        <span className="text-sm">Equipment Tested & Tagged</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedReport.equipment_clean_working ? 'default' : 'secondary'}>
                          {selectedReport.equipment_clean_working ? '✓' : '✗'}
                        </Badge>
                        <span className="text-sm">Equipment Clean & Working</span>
                      </div>
                    </div>
                  </div>

                  {/* Work Description */}
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="font-semibold">Work Completed</h3>
                    {editMode ? (
                      <Textarea value={selectedReport.work_description} rows={4} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{selectedReport.work_description}</p>
                    )}
                  </div>

                  {selectedReport.internal_notes && (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="font-semibold">Internal Notes</h3>
                      {editMode ? (
                        <Textarea value={selectedReport.internal_notes} rows={3} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                          {selectedReport.internal_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Photos */}
                  {selectedReport.photos && selectedReport.photos.length > 0 && (
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="font-semibold">Photos</h3>
                      
                      {/* Before/After Pairs */}
                      {beforePhotos.length > 0 && (
                        <div className="space-y-2">
                          <Label>Before & After</Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {beforePhotos.map((beforePhoto: any) => {
                              const pairedAfter = afterPhotos.find((a: any) => 
                                a.id === beforePhoto.paired_photo_id || a.paired_photo_id === beforePhoto.id
                              );
                              return (
                                <div key={beforePhoto.id} className="grid grid-cols-2 gap-2">
                                  <div className="relative">
                                    <img 
                                      src={beforePhoto.file_url} 
                                      alt="Before" 
                                      className="w-full h-48 object-cover rounded"
                                    />
                                    <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                                      Before
                                    </div>
                                  </div>
                                  {pairedAfter && (
                                    <div className="relative">
                                      <img 
                                        src={pairedAfter.file_url} 
                                        alt="After" 
                                        className="w-full h-48 object-cover rounded"
                                      />
                                      <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                                        After
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Other Photos */}
                      {selectedReport.photos.filter((p: any) => !['before', 'after'].includes(p.photo_type)).length > 0 && (
                        <div className="space-y-2">
                          <Label>Additional Photos</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {selectedReport.photos
                              .filter((p: any) => !['before', 'after'].includes(p.photo_type))
                              .map((photo: any) => (
                                <img 
                                  key={photo.id}
                                  src={photo.file_url} 
                                  alt={photo.photo_type} 
                                  className="w-full h-32 object-cover rounded"
                                />
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Problem Areas */}
                  {selectedReport.had_problem_areas && (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="font-semibold text-amber-600">Problem Areas</h3>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-muted-foreground">Description</Label>
                          <p className="text-sm">{selectedReport.problem_areas_description}</p>
                        </div>
                        {selectedReport.methods_attempted && (
                          <div>
                            <Label className="text-muted-foreground">Methods Attempted</Label>
                            <p className="text-sm">{selectedReport.methods_attempted}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Incidents */}
                  {selectedReport.had_incident && (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="font-semibold text-red-600">Incident Report</h3>
                      <p className="text-sm">{selectedReport.incident_description}</p>
                    </div>
                  )}

                  {/* Customer Signature */}
                  {selectedReport.customer_signature_data && (
                    <div className="space-y-3 border-t pt-4">
                      <h3 className="font-semibold">Customer Signature</h3>
                      <img 
                        src={selectedReport.customer_signature_data} 
                        alt="Customer Signature" 
                        className="border rounded h-32 bg-white"
                      />
                      {selectedReport.customer_signature_name && (
                        <p className="text-sm text-muted-foreground">
                          Signed by: {selectedReport.customer_signature_name}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>

      <FieldReportDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </DashboardLayout>
  );
}
