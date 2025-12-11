import { useState, useMemo, useRef } from 'react';
import { useLogListPageAccess } from '@/hooks/useLogDetailPageAccess';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Download, Edit, Plus, AlertTriangle, Loader2, X, ImagePlus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import FieldReportDialog from '@/components/field-reports/FieldReportDialog';
import { ContractorMappingDialog } from '@/components/field-reports/ContractorMappingDialog';
import { QuickMappingPanel } from '@/components/field-reports/QuickMappingPanel';
import { FieldReportPDFDocument } from '@/components/field-reports/FieldReportPDFDocument';
import { FieldReportPDFPreview } from '@/components/field-reports/FieldReportPDFPreview';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionButton } from '@/components/permissions/PermissionButton';
import { pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';

interface EditFormData {
  worker_name: string;
  arrival_time: string;
  carpet_condition_arrival: number;
  hard_floor_condition_arrival: number;
  flooring_state_description: string;
  work_description: string;
  internal_notes: string;
  problem_areas_description: string;
  methods_attempted: string;
  had_problem_areas: boolean;
}

interface PhotoToDelete {
  id: string;
  file_url: string;
  photo_type: string;
}

interface NewPhoto {
  file: File;
  preview: string;
  photo_type: 'before' | 'after';
}

export default function FieldReports() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [reportToMap, setReportToMap] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Photo management state
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<PhotoToDelete | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // File input refs
  const beforePhotoInputRef = useRef<HTMLInputElement>(null);
  const afterPhotoInputRef = useRef<HTMLInputElement>(null);

  // Log list page access for audit trail
  useLogListPageAccess('field_reports');

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

  // Fetch company settings for PDF branding
  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant-settings-pdf'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) return null;

      const { data, error } = await supabase
        .from('tenant_settings')
        .select('company_name, logo_url, company_phone, company_email')
        .eq('tenant_id', profile.tenant_id)
        .single();

      if (error) return null;
      return data;
    },
  });

  const handleGeneratePDF = async () => {
    if (!selectedReport || !tenantSettings) {
      toast.error('Unable to generate PDF. Please try again.');
      return;
    }

    try {
      setGeneratingPDF(true);
      toast.info('Generating PDF...');

      const companySettings = {
        name: tenantSettings.company_name || 'Company',
        logo_url: tenantSettings.logo_url,
        address: null,
        phone: tenantSettings.company_phone,
        email: tenantSettings.company_email,
      };

      const blob = await pdf(
        <FieldReportPDFDocument
          report={{
            ...selectedReport,
            photos: selectedReport.photos?.map((p: any) => ({
              ...p,
              photo_type: p.photo_type as 'before' | 'after' | 'problem' | 'other',
            })),
          }}
          companySettings={companySettings}
        />
      ).toBlob();

      saveAs(blob, `Service-Report-${selectedReport.report_number}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPDF(false);
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
      queryClient.invalidateQueries({ queryKey: ['field-reports'] });
      queryClient.invalidateQueries({ queryKey: ['field-report', selectedReportId] });
    } catch (error) {
      console.error('Error approving report:', error);
      toast.error('Failed to approve report');
    }
  };

  const handleUnapproveReport = async () => {
    if (!selectedReportId) return;
    
    try {
      const { error } = await supabase
        .from('field_reports')
        .update({
          status: 'submitted',
          approved_at: null,
          approved_by: null,
        })
        .eq('id', selectedReportId);

      if (error) throw error;

      toast.success('Report unapproved - now editable');
      queryClient.invalidateQueries({ queryKey: ['field-reports'] });
      queryClient.invalidateQueries({ queryKey: ['field-report', selectedReportId] });
    } catch (error) {
      console.error('Error unapproving report:', error);
      toast.error('Failed to unapprove report');
    }
  };

  const handleEnterEditMode = () => {
    if (!selectedReport) return;
    setEditFormData({
      worker_name: selectedReport.worker_name || '',
      arrival_time: selectedReport.arrival_time || '',
      carpet_condition_arrival: selectedReport.carpet_condition_arrival || 3,
      hard_floor_condition_arrival: selectedReport.hard_floor_condition_arrival || 3,
      flooring_state_description: selectedReport.flooring_state_description || '',
      work_description: selectedReport.work_description || '',
      internal_notes: selectedReport.internal_notes || '',
      problem_areas_description: selectedReport.problem_areas_description || '',
      methods_attempted: selectedReport.methods_attempted || '',
      had_problem_areas: selectedReport.had_problem_areas || false,
    });
    setPhotosToDelete([]);
    setNewPhotos([]);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditFormData(null);
    setPhotosToDelete([]);
    // Cleanup previews
    newPhotos.forEach(p => URL.revokeObjectURL(p.preview));
    setNewPhotos([]);
  };
  
  const handleDeletePhotoClick = (photo: PhotoToDelete) => {
    setPhotoToDelete(photo);
    setDeleteConfirmText('');
    setDeleteConfirmOpen(true);
  };
  
  const handleConfirmDeletePhoto = () => {
    if (photoToDelete && deleteConfirmText.toLowerCase() === 'delete') {
      setPhotosToDelete(prev => [...prev, photoToDelete.id]);
      setDeleteConfirmOpen(false);
      setPhotoToDelete(null);
      setDeleteConfirmText('');
    }
  };
  
  const handleAddPhoto = (files: FileList | null, photoType: 'before' | 'after') => {
    if (!files || files.length === 0) return;
    
    const newItems: NewPhoto[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      photo_type: photoType,
    }));
    
    setNewPhotos(prev => [...prev, ...newItems]);
  };
  
  const handleRemoveNewPhoto = (index: number) => {
    setNewPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSaveChanges = async () => {
    if (!selectedReportId || !editFormData) return;
    
    try {
      setIsSaving(true);
      
      // 1. Delete photos marked for deletion
      if (photosToDelete.length > 0) {
        // Get file URLs for storage deletion
        const photosData = selectedReport?.photos?.filter((p: any) => photosToDelete.includes(p.id)) || [];
        
        // Delete from storage
        for (const photo of photosData) {
          try {
            const urlParts = photo.file_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            await supabase.storage.from('field-report-photos').remove([fileName]);
          } catch (storageError) {
            console.warn('Failed to delete from storage:', storageError);
          }
        }
        
        // Delete from database
        const { error: deleteError } = await supabase
          .from('field_report_photos')
          .delete()
          .in('id', photosToDelete);
          
        if (deleteError) throw deleteError;
      }
      
      // 2. Upload new photos
      if (newPhotos.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
          
        if (!profile?.tenant_id) throw new Error('No tenant found');
        
        for (const newPhoto of newPhotos) {
          // Upload to storage
          const fileExt = newPhoto.file.name.split('.').pop();
          const fileName = `${selectedReportId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('field-report-photos')
            .upload(fileName, newPhoto.file);
            
          if (uploadError) throw uploadError;
          
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('field-report-photos')
            .getPublicUrl(fileName);
          
          // Insert record
          const { error: insertError } = await supabase
            .from('field_report_photos')
            .insert({
              field_report_id: selectedReportId,
              tenant_id: profile.tenant_id,
              file_url: publicUrl,
              file_name: newPhoto.file.name,
              photo_type: newPhoto.photo_type,
              uploaded_by: user.id,
            });
            
          if (insertError) throw insertError;
        }
      }
      
      // 3. Update report fields
      const { error } = await supabase
        .from('field_reports')
        .update({
          worker_name: editFormData.worker_name || null,
          arrival_time: editFormData.arrival_time || null,
          carpet_condition_arrival: editFormData.carpet_condition_arrival,
          hard_floor_condition_arrival: editFormData.hard_floor_condition_arrival,
          flooring_state_description: editFormData.flooring_state_description || null,
          work_description: editFormData.work_description || null,
          internal_notes: editFormData.internal_notes || null,
          problem_areas_description: editFormData.problem_areas_description || null,
          methods_attempted: editFormData.methods_attempted || null,
          had_problem_areas: editFormData.had_problem_areas,
        })
        .eq('id', selectedReportId);

      if (error) throw error;

      toast.success('Report updated successfully');
      queryClient.invalidateQueries({ queryKey: ['field-reports'] });
      queryClient.invalidateQueries({ queryKey: ['field-report', selectedReportId] });
      setEditMode(false);
      setEditFormData(null);
      setPhotosToDelete([]);
      newPhotos.forEach(p => URL.revokeObjectURL(p.preview));
      setNewPhotos([]);
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('Failed to update report');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredReports = reports?.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      report.report_number.toLowerCase().includes(searchLower) ||
      report.worker_name?.toLowerCase().includes(searchLower) ||
      report.customer?.name?.toLowerCase().includes(searchLower) ||
      report.manual_location_entry?.toLowerCase().includes(searchLower)
    );
    
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending_mapping') {
        return matchesSearch && report.needs_customer_mapping === true;
      }
      return matchesSearch && report.status === statusFilter;
    }
    
    return matchesSearch;
  });

  // Get reports that need mapping
  const reportsNeedingMapping = useMemo(() => {
    return reports?.filter(r => r.needs_customer_mapping) || [];
  }, [reports]);

  const pendingMappingCount = reportsNeedingMapping.length;

  // Check if we're in mapping queue mode
  const isInMappingMode = statusFilter === 'pending_mapping';
  const selectedReportNeedsMapping = selectedReport?.needs_customer_mapping;

  // Get next unmapped report
  const getNextUnmappedReport = () => {
    const currentIndex = reportsNeedingMapping.findIndex(r => r.id === selectedReportId);
    if (currentIndex < reportsNeedingMapping.length - 1) {
      return reportsNeedingMapping[currentIndex + 1];
    }
    return reportsNeedingMapping[0];
  };

  const handleMappingComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['field-reports'] });
    queryClient.invalidateQueries({ queryKey: ['field-report', selectedReportId] });
    
    // Auto-advance to next unmapped report
    const next = getNextUnmappedReport();
    if (next && next.id !== selectedReportId) {
      setSelectedReportId(next.id);
    }
  };

  const handleSkipToNext = () => {
    const next = getNextUnmappedReport();
    if (next) {
      setSelectedReportId(next.id);
    }
  };

  const getStatusColor = (status: string, needsMapping?: boolean) => {
    if (needsMapping) return 'destructive';
    switch (status) {
      case 'draft': return 'secondary';
      case 'submitted': return 'default';
      case 'contractor_submitted': return 'default';
      case 'approved': return 'default';
      case 'pending_mapping': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string, needsMapping?: boolean) => {
    if (needsMapping) return 'Needs Mapping';
    if (status === 'contractor_submitted') return 'Contractor';
    return status;
  };

  const beforePhotos = selectedReport?.photos?.filter((p: any) => p.photo_type === 'before') || [];
  const afterPhotos = selectedReport?.photos?.filter((p: any) => p.photo_type === 'after') || [];

  return (
    <DashboardLayout>
      <div className="flex-1 flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-2xl font-bold">Field Reports</h1>
          <PermissionButton 
            module="field_reports" 
            permission="create"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Report
          </PermissionButton>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Panel - Reports List */}
          <div className="w-full lg:w-96 border-r bg-background flex flex-col">
            <div className="p-4 border-b space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Field Reports</h2>
                <div className="flex items-center gap-2">
                  {pendingMappingCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="animate-pulse cursor-pointer"
                      onClick={() => {
                        setStatusFilter('pending_mapping');
                        if (reportsNeedingMapping[0]) {
                          setSelectedReportId(reportsNeedingMapping[0].id);
                        }
                      }}
                    >
                      {pendingMappingCount} needs mapping
                    </Badge>
                  )}
                  <Badge variant="secondary">{filteredReports?.length || 0}</Badge>
                </div>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_mapping">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      Needs Mapping ({pendingMappingCount})
                    </span>
                  </SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="contractor_submitted">Contractor</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
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
                          <Badge variant={getStatusColor(report.status, report.needs_customer_mapping)}>
                            {getStatusLabel(report.status, report.needs_customer_mapping)}
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          {report.customer?.name ? (
                            <p className="font-medium">{report.customer.name}</p>
                          ) : report.manual_location_entry ? (
                            <p className="font-medium text-muted-foreground italic truncate">
                              "{report.manual_location_entry}"
                            </p>
                          ) : null}
                          <p className="text-muted-foreground">{report.worker_name || report.contractor_name}</p>
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

          {/* Right Panel - Report Details + PDF Preview */}
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={60} minSize={35}>
              <div className="h-full overflow-y-auto">
                {!selectedReport ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center space-y-2">
                      <FileText className="h-12 w-12 mx-auto opacity-20" />
                      <p>Select a report to view details</p>
                    </div>
                  </div>
                ) : selectedReportNeedsMapping ? (
                  // Quick Mapping Panel for reports needing mapping
                  <div className="p-6 max-w-xl mx-auto">
                    <QuickMappingPanel
                      report={{
                        id: selectedReport.id,
                        report_number: selectedReport.report_number,
                        manual_location_entry: selectedReport.manual_location_entry,
                        contractor_phone: selectedReport.contractor_phone,
                        contractor_name: selectedReport.contractor_name,
                        service_date: selectedReport.service_date,
                      }}
                      onMapped={handleMappingComplete}
                      onNext={handleSkipToNext}
                      hasNext={reportsNeedingMapping.length > 1}
                    />
                  </div>
                ) : (
                  // Regular Report Details
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
                        {selectedReport.status !== 'approved' && (
                          <>
                            {editMode ? (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  size="sm" 
                                  onClick={handleSaveChanges}
                                  disabled={isSaving}
                                >
                                  {isSaving ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    'Save Changes'
                                  )}
                                </Button>
                              </>
                            ) : (
                              <PermissionButton 
                                module="field_reports" 
                                permission="edit"
                                variant="outline" 
                                size="sm" 
                                onClick={handleEnterEditMode}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </PermissionButton>
                            )}
                          </>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleGeneratePDF}
                          disabled={generatingPDF}
                        >
                          {generatingPDF ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </>
                          )}
                        </Button>
                        {selectedReport.status === 'approved' ? (
                          <PermissionButton 
                            module="field_reports" 
                            permission="edit"
                            variant="outline" 
                            size="sm" 
                            onClick={handleUnapproveReport}
                          >
                            Unapprove Report
                          </PermissionButton>
                        ) : (
                          <PermissionButton 
                            module="field_reports" 
                            permission="edit"
                            size="sm" 
                            onClick={handleApproveReport}
                          >
                            Approve Report
                          </PermissionButton>
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
                            {editMode && editFormData ? (
                              <Input 
                                value={editFormData.worker_name} 
                                onChange={(e) => setEditFormData({ ...editFormData, worker_name: e.target.value })}
                              />
                            ) : (
                              <p className="font-medium">{selectedReport.worker_name}</p>
                            )}
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
                            {editMode && editFormData ? (
                              <Input 
                                value={editFormData.arrival_time} 
                                onChange={(e) => setEditFormData({ ...editFormData, arrival_time: e.target.value })}
                              />
                            ) : (
                              <p className="font-medium">{selectedReport.arrival_time}</p>
                            )}
                          </div>
                        </div>

                        {/* Condition Ratings */}
                        <div className="space-y-3 border-t pt-4">
                          <h3 className="font-semibold">Condition on Arrival</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-muted-foreground">Carpet Condition</Label>
                              {editMode && editFormData ? (
                                <Select 
                                  value={String(editFormData.carpet_condition_arrival)}
                                  onValueChange={(v) => setEditFormData({ ...editFormData, carpet_condition_arrival: Number(v) })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1,2,3,4,5].map(n => (
                                      <SelectItem key={n} value={String(n)}>{n}/5</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <p className="text-2xl font-bold">{selectedReport.carpet_condition_arrival}/5</p>
                              )}
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Hard Floor Condition</Label>
                              {editMode && editFormData ? (
                                <Select 
                                  value={String(editFormData.hard_floor_condition_arrival)}
                                  onValueChange={(v) => setEditFormData({ ...editFormData, hard_floor_condition_arrival: Number(v) })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1,2,3,4,5].map(n => (
                                      <SelectItem key={n} value={String(n)}>{n}/5</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <p className="text-2xl font-bold">{selectedReport.hard_floor_condition_arrival}/5</p>
                              )}
                            </div>
                          </div>
                          {(editMode || selectedReport.flooring_state_description) && (
                            <div>
                              <Label className="text-muted-foreground">Overall State</Label>
                              {editMode && editFormData ? (
                                <Textarea 
                                  value={editFormData.flooring_state_description} 
                                  onChange={(e) => setEditFormData({ ...editFormData, flooring_state_description: e.target.value })}
                                  rows={3}
                                  placeholder="Describe the overall flooring state..."
                                />
                              ) : (
                                <p className="text-sm">{selectedReport.flooring_state_description}</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Work Description */}
                        <div className="space-y-3 border-t pt-4">
                          <h3 className="font-semibold">Work Completed</h3>
                          {editMode && editFormData ? (
                            <Textarea 
                              value={editFormData.work_description} 
                              onChange={(e) => setEditFormData({ ...editFormData, work_description: e.target.value })}
                              rows={4}
                              placeholder="Describe the work completed..."
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{selectedReport.work_description}</p>
                          )}
                        </div>

                        {/* Internal Notes */}
                        {(editMode || selectedReport.internal_notes) && (
                          <div className="space-y-3 border-t pt-4">
                            <h3 className="font-semibold flex items-center gap-2">
                              Internal Notes
                              <Badge variant="secondary" className="text-xs">Internal Only</Badge>
                            </h3>
                            {editMode && editFormData ? (
                              <Textarea 
                                value={editFormData.internal_notes} 
                                onChange={(e) => setEditFormData({ ...editFormData, internal_notes: e.target.value })}
                                rows={3}
                                placeholder="Add internal notes..."
                              />
                            ) : (
                              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                                {selectedReport.internal_notes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Photos */}
                        <div className="space-y-4 border-t pt-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Photos</h3>
                            {editMode && (
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => beforePhotoInputRef.current?.click()}
                                >
                                  <ImagePlus className="h-4 w-4 mr-1" />
                                  Add Before
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => afterPhotoInputRef.current?.click()}
                                >
                                  <ImagePlus className="h-4 w-4 mr-1" />
                                  Add After
                                </Button>
                                <input
                                  ref={beforePhotoInputRef}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => handleAddPhoto(e.target.files, 'before')}
                                />
                                <input
                                  ref={afterPhotoInputRef}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => handleAddPhoto(e.target.files, 'after')}
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* Before/After Pairs */}
                          {beforePhotos.length > 0 && (
                            <div className="space-y-2">
                              <Label>Before & After</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {beforePhotos.map((beforePhoto: any) => {
                                  const isMarkedForDelete = photosToDelete.includes(beforePhoto.id);
                                  const pairedAfter = afterPhotos.find((a: any) => 
                                    a.id === beforePhoto.paired_photo_id || a.paired_photo_id === beforePhoto.id
                                  );
                                  const isPairedMarkedForDelete = pairedAfter && photosToDelete.includes(pairedAfter.id);
                                  
                                  return (
                                    <div key={beforePhoto.id} className="grid grid-cols-2 gap-2">
                                      <div className={`relative ${isMarkedForDelete ? 'opacity-50' : ''}`}>
                                        <img 
                                          src={beforePhoto.file_url} 
                                          alt="Before" 
                                          className="w-full h-48 object-cover rounded"
                                        />
                                        <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                                          Before
                                        </div>
                                        {isMarkedForDelete && (
                                          <div className="absolute inset-0 bg-destructive/30 rounded flex items-center justify-center">
                                            <span className="text-destructive-foreground bg-destructive px-2 py-1 rounded text-xs font-medium">
                                              Will be deleted
                                            </span>
                                          </div>
                                        )}
                                        {editMode && !isMarkedForDelete && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePhotoClick({
                                              id: beforePhoto.id,
                                              file_url: beforePhoto.file_url,
                                              photo_type: 'before'
                                            })}
                                            className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/80"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                      {pairedAfter && (
                                        <div className={`relative ${isPairedMarkedForDelete ? 'opacity-50' : ''}`}>
                                          <img 
                                            src={pairedAfter.file_url} 
                                            alt="After" 
                                            className="w-full h-48 object-cover rounded"
                                          />
                                          <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                                            After
                                          </div>
                                          {isPairedMarkedForDelete && (
                                            <div className="absolute inset-0 bg-destructive/30 rounded flex items-center justify-center">
                                              <span className="text-destructive-foreground bg-destructive px-2 py-1 rounded text-xs font-medium">
                                                Will be deleted
                                              </span>
                                            </div>
                                          )}
                                          {editMode && !isPairedMarkedForDelete && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeletePhotoClick({
                                                id: pairedAfter.id,
                                                file_url: pairedAfter.file_url,
                                                photo_type: 'after'
                                              })}
                                              className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/80"
                                            >
                                              <X className="h-4 w-4" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Unpaired After Photos */}
                          {afterPhotos.filter((a: any) => 
                            !beforePhotos.some((b: any) => b.paired_photo_id === a.id || a.paired_photo_id === b.id)
                          ).length > 0 && (
                            <div className="space-y-2">
                              <Label>After Photos (Unpaired)</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {afterPhotos
                                  .filter((a: any) => !beforePhotos.some((b: any) => b.paired_photo_id === a.id || a.paired_photo_id === b.id))
                                  .map((photo: any) => {
                                    const isMarkedForDelete = photosToDelete.includes(photo.id);
                                    return (
                                      <div key={photo.id} className={`relative ${isMarkedForDelete ? 'opacity-50' : ''}`}>
                                        <img 
                                          src={photo.file_url} 
                                          alt="After" 
                                          className="w-full h-32 object-cover rounded"
                                        />
                                        <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                                          After
                                        </div>
                                        {isMarkedForDelete && (
                                          <div className="absolute inset-0 bg-destructive/30 rounded flex items-center justify-center">
                                            <span className="text-destructive-foreground bg-destructive px-2 py-1 rounded text-xs font-medium">
                                              Will be deleted
                                            </span>
                                          </div>
                                        )}
                                        {editMode && !isMarkedForDelete && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePhotoClick({
                                              id: photo.id,
                                              file_url: photo.file_url,
                                              photo_type: 'after'
                                            })}
                                            className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/80"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}

                          {/* New Photos Preview */}
                          {editMode && newPhotos.length > 0 && (
                            <div className="space-y-2">
                              <Label>New Photos (Pending Upload)</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {newPhotos.map((newPhoto, index) => (
                                  <div key={index} className="relative">
                                    <img 
                                      src={newPhoto.preview} 
                                      alt={`New ${newPhoto.photo_type}`} 
                                      className="w-full h-32 object-cover rounded border-2 border-dashed border-primary"
                                    />
                                    <div className={`absolute top-2 left-2 ${newPhoto.photo_type === 'before' ? 'bg-red-500' : 'bg-green-500'} text-white px-2 py-1 rounded text-xs font-medium`}>
                                      {newPhoto.photo_type === 'before' ? 'Before' : 'After'}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveNewPhoto(index)}
                                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/80"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Other Photos */}
                          {selectedReport?.photos?.filter((p: any) => !['before', 'after'].includes(p.photo_type)).length > 0 && (
                            <div className="space-y-2">
                              <Label>Additional Photos</Label>
                              <div className="grid grid-cols-3 gap-2">
                                {selectedReport.photos
                                  .filter((p: any) => !['before', 'after'].includes(p.photo_type))
                                  .map((photo: any) => {
                                    const isMarkedForDelete = photosToDelete.includes(photo.id);
                                    return (
                                      <div key={photo.id} className={`relative ${isMarkedForDelete ? 'opacity-50' : ''}`}>
                                        <img 
                                          src={photo.file_url} 
                                          alt={photo.photo_type} 
                                          className="w-full h-32 object-cover rounded"
                                        />
                                        {isMarkedForDelete && (
                                          <div className="absolute inset-0 bg-destructive/30 rounded flex items-center justify-center">
                                            <span className="text-destructive-foreground bg-destructive px-2 py-1 rounded text-xs font-medium">
                                              Will be deleted
                                            </span>
                                          </div>
                                        )}
                                        {editMode && !isMarkedForDelete && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePhotoClick({
                                              id: photo.id,
                                              file_url: photo.file_url,
                                              photo_type: photo.photo_type
                                            })}
                                            className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/80"
                                          >
                                            <X className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                          
                          {/* Empty state */}
                          {(!selectedReport?.photos || selectedReport.photos.length === 0) && newPhotos.length === 0 && (
                            <p className="text-muted-foreground text-sm">No photos attached</p>
                          )}
                        </div>

                        {/* Problem Areas */}
                        {(editMode || selectedReport.had_problem_areas) && (
                          <div className="space-y-3 border-t pt-4">
                            <h3 className="font-semibold text-amber-600">Problem Areas</h3>
                            <div className="space-y-2">
                              <div>
                                <Label className="text-muted-foreground">Description</Label>
                                {editMode && editFormData ? (
                                  <Textarea 
                                    value={editFormData.problem_areas_description} 
                                    onChange={(e) => setEditFormData({ ...editFormData, problem_areas_description: e.target.value })}
                                    rows={3}
                                    placeholder="Describe any problem areas..."
                                  />
                                ) : (
                                  <p className="text-sm">{selectedReport.problem_areas_description}</p>
                                )}
                              </div>
                              {(editMode || selectedReport.methods_attempted) && (
                                <div>
                                  <Label className="text-muted-foreground">Methods Attempted</Label>
                                  {editMode && editFormData ? (
                                    <Textarea 
                                      value={editFormData.methods_attempted} 
                                      onChange={(e) => setEditFormData({ ...editFormData, methods_attempted: e.target.value })}
                                      rows={3}
                                      placeholder="Describe methods attempted to resolve..."
                                    />
                                  ) : (
                                    <p className="text-sm">{selectedReport.methods_attempted}</p>
                                  )}
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
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            {/* PDF Preview Panel */}
            <ResizablePanel defaultSize={40} minSize={25} className="hidden lg:block">
              <FieldReportPDFPreview
                report={selectedReport}
                companySettings={tenantSettings ? {
                  name: tenantSettings.company_name || 'Company',
                  logo_url: tenantSettings.logo_url,
                  address: null,
                  phone: tenantSettings.company_phone,
                  email: tenantSettings.company_email,
                } : null}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <FieldReportDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <ContractorMappingDialog
        open={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        report={reportToMap}
      />

      {/* Delete Photo Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Photo Permanently
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              {photoToDelete && (
                <div className="flex justify-center my-4">
                  <img 
                    src={photoToDelete.file_url} 
                    alt="Photo to delete" 
                    className="max-h-40 rounded border"
                  />
                </div>
              )}
              <p>
                This action cannot be undone. The photo will be permanently deleted from this report.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">Type <span className="font-bold">delete</span> to confirm:</Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type 'delete' to confirm"
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteConfirmText('');
              setPhotoToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeletePhoto}
              disabled={deleteConfirmText.toLowerCase() !== 'delete'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
