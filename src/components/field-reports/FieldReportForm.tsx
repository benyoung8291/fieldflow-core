import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import SignaturePad from '@/components/worker/SignaturePad';
import BeforeAfterPhotoUpload from './BeforeAfterPhotoUpload';
import { useQuery } from '@tanstack/react-query';
import { Save } from 'lucide-react';

interface FieldReportFormProps {
  appointmentId?: string;
  customerId?: string;
  locationId?: string;
  serviceOrderId?: string;
  onSave?: () => void;
}

interface PhotoPair {
  id: string;
  before?: {
    fileUrl: string; // Uploaded URL
    preview: string;
    notes: string;
    fileName: string;
  };
  after?: {
    fileUrl: string; // Uploaded URL
    preview: string;
    notes: string;
    fileName: string;
  };
}

export default function FieldReportForm({
  appointmentId,
  customerId,
  locationId,
  serviceOrderId,
  onSave
}: FieldReportFormProps) {
  const [loading, setLoading] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [photoPairs, setPhotoPairs] = useState<PhotoPair[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftReportId, setDraftReportId] = useState<string | null>(null);
  
  // Generate a unique key for this field report
  const storageKey = `field-report-draft-${appointmentId || 'standalone'}`;
  
  const [formData, setFormData] = useState({
    worker_name: '',
    service_date: new Date().toISOString().split('T')[0],
    arrival_time: '',
    appointment_id: appointmentId || '',
    service_order_id: serviceOrderId || '',
    carpet_condition_arrival: 3,
    hard_floor_condition_arrival: 3,
    flooring_state_description: '',
    has_signed_swms: false,
    equipment_tested_tagged: false,
    equipment_clean_working: false,
    work_description: '',
    internal_notes: '',
    had_problem_areas: false,
    problem_areas_description: '',
    methods_attempted: '',
    had_incident: false,
    incident_description: '',
    customer_signature_data: '',
    customer_signature_name: '',
    customer_signature_date: '',
  });

  // Load saved draft from local storage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed.formData);
        if (parsed.photoPairs) {
          setPhotoPairs(parsed.photoPairs);
        }
        if (parsed.draftReportId) {
          setDraftReportId(parsed.draftReportId);
        }
        setLastSaved(new Date(parsed.savedAt));
        toast.info('Draft restored', {
          description: 'Your previous work has been restored'
        });
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, [storageKey]);

  // Auto-save to local storage and database whenever form data or photos change
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const savedAt = new Date().toISOString();
      const draftData = {
        formData,
        photoPairs,
        draftReportId,
        savedAt
      };
      
      // Save to local storage
      localStorage.setItem(storageKey, JSON.stringify(draftData));
      setLastSaved(new Date());
      
      // Also save to database if online (for supervisor visibility)
      if (navigator.onLine) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();
            
          if (!profile) return;
          
          const reportNumber = draftReportId ? undefined : `FR-DRAFT-${Date.now()}`;
          
          if (draftReportId) {
            // Update existing draft
            await supabase
              .from('field_reports')
              .update({
                ...formData,
                appointment_id: formData.appointment_id || null,
                service_order_id: formData.service_order_id || null,
                customer_id: customerId || null,
                location_id: locationId || null,
              })
              .eq('id', draftReportId);
          } else {
            // Create new draft
            const { data: newReport } = await supabase
              .from('field_reports')
              .insert({
                tenant_id: profile.tenant_id,
                appointment_id: formData.appointment_id || null,
                service_order_id: formData.service_order_id || null,
                customer_id: customerId || null,
                location_id: locationId || null,
                report_number: reportNumber!,
                created_by: user.id,
                status: 'draft',
                ...formData,
              })
              .select('id')
              .single();
              
            if (newReport) {
              setDraftReportId(newReport.id);
            }
          }
        } catch (error) {
          console.error('Error saving draft to database:', error);
          // Continue silently - local storage still saved
        }
      }
    }, 2000); // Debounce by 2 seconds

    return () => clearTimeout(timeoutId);
  }, [formData, photoPairs, storageKey, draftReportId, customerId, locationId]);

  // Auto-populate logged-in user name
  useEffect(() => {
    const loadUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        if (profile?.first_name) {
          const fullName = `${profile.first_name} ${profile.last_name || ''}`.trim();
          setFormData(prev => ({ ...prev, worker_name: fullName }));
        }
      }
    };
    loadUserName();
  }, []);

  // Fetch open appointments
  const { data: appointments } = useQuery({
    queryKey: ['open-appointments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, title, start_time')
        .in('status', ['published', 'checked_in'])
        .order('start_time', { ascending: true })
        .limit(50);
      return data || [];
    },
  });

  // Fetch service orders
  const { data: serviceOrders } = useQuery({
    queryKey: ['service-orders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_orders')
        .select('id, work_order_number, title')
        .in('status', ['scheduled', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Validate required fields
      if (!formData.worker_name) {
        toast.error('Worker name is required');
        setLoading(false);
        return;
      }
      if (!formData.arrival_time) {
        toast.error('Time of attendance is required');
        setLoading(false);
        return;
      }
      if (!formData.work_description) {
        toast.error('Work description is required');
        setLoading(false);
        return;
      }
      
      console.log('Starting field report submission...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        throw new Error('You must be logged in to submit a field report');
      }

      console.log('User authenticated, fetching profile...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        throw new Error('Unable to load your profile. Please try again.');
      }

      let report;
      
      if (draftReportId) {
        // Update existing draft to submitted
        console.log('Updating draft to submitted...');
        const reportNumber = `FR-${Date.now()}`;
        const { data: updatedReport, error: updateError } = await supabase
          .from('field_reports')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            report_number: reportNumber,
            ...formData,
          })
          .eq('id', draftReportId)
          .select()
          .single();
          
        if (updateError) {
          console.error('Field report update error:', updateError);
          throw new Error(`Failed to update report: ${updateError.message}`);
        }
        report = updatedReport;
      } else {
        // Create new report
        const reportNumber = `FR-${Date.now()}`;
        console.log('Creating field report...');
        const { data: newReport, error: reportError } = await supabase
          .from('field_reports')
          .insert({
            tenant_id: profile.tenant_id,
            appointment_id: formData.appointment_id || null,
            service_order_id: formData.service_order_id || null,
            customer_id: customerId,
            location_id: locationId,
            report_number: reportNumber,
            created_by: user.id,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            ...formData,
          })
          .select()
          .single();

        if (reportError) {
          console.error('Field report creation error:', reportError);
          throw new Error(`Failed to create report: ${reportError.message}`);
        }
        report = newReport;
      }
      
      console.log('Field report saved successfully:', report.id);

      // Prepare photo records (photos already uploaded in background)
      console.log(`Preparing ${photoPairs.length} photo pairs...`);
      const allPhotos: any[] = [];
      for (const pair of photoPairs) {
        if (pair.before) {
          allPhotos.push({
            file_url: pair.before.fileUrl,
            file_name: pair.before.fileName,
            photo_type: 'before',
            notes: pair.before.notes,
          });
        }
        if (pair.after) {
          allPhotos.push({
            file_url: pair.after.fileUrl,
            file_name: pair.after.fileName,
            photo_type: 'after',
            notes: pair.after.notes,
          });
        }
      }
      console.log(`Prepared ${allPhotos.length} photos`);

      if (allPhotos.length > 0) {
        console.log('Saving photo records to database...');
        const photoInserts = allPhotos.map((photo, index) => ({
          tenant_id: profile.tenant_id,
          field_report_id: report.id,
          file_url: photo.file_url,
          file_name: photo.file_name,
          file_type: 'image/jpeg',
          photo_type: photo.photo_type,
          notes: photo.notes,
          display_order: index,
          uploaded_by: user.id,
        }));

        const { error: photosError } = await supabase
          .from('field_report_photos')
          .insert(photoInserts);

        if (photosError) {
          console.error('Photo records save error:', photosError);
          throw new Error(`Failed to save photo records: ${photosError.message}`);
        }
        console.log('Photo records saved successfully');
      }

      // Clear local storage draft on successful submission
      localStorage.removeItem(storageKey);
      
      console.log('Field report submission completed successfully');
      toast.success('Field report submitted successfully');
      onSave?.();
    } catch (error: any) {
      console.error('Error submitting report:', error);
      const errorMessage = error?.message || 'Failed to submit field report. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Field Report</CardTitle>
              {lastSaved && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Save className="h-4 w-4" />
                  <span>Draft saved {lastSaved.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="worker_name">Your Name *</Label>
                <Input
                  id="worker_name"
                  value={formData.worker_name}
                  onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment">Link to Appointment (Optional)</Label>
                <Select
                  value={formData.appointment_id}
                  onValueChange={(val) => setFormData({ ...formData, appointment_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select appointment..." />
                  </SelectTrigger>
                  <SelectContent>
                    {appointments?.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id}>
                        {apt.title} - {new Date(apt.start_time).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service_order">Link to Service Order (Optional)</Label>
                <Select
                  value={formData.service_order_id}
                  onValueChange={(val) => setFormData({ ...formData, service_order_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service order..." />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceOrders?.map((so) => (
                      <SelectItem key={so.id} value={so.id}>
                        {so.work_order_number} - {so.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service_date">Date of Service *</Label>
                <Input
                  id="service_date"
                  type="date"
                  value={formData.service_date}
                  onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arrival_time">Time of Attendance *</Label>
                <Input
                  id="arrival_time"
                  type="time"
                  value={formData.arrival_time}
                  onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Condition Ratings */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Condition on Arrival</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Carpet Condition: {formData.carpet_condition_arrival}</Label>
                  <Slider
                    value={[formData.carpet_condition_arrival]}
                    onValueChange={(val) => setFormData({ ...formData, carpet_condition_arrival: val[0] })}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Poor</span>
                    <span>Excellent</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Hard Floor Condition: {formData.hard_floor_condition_arrival}</Label>
                  <Slider
                    value={[formData.hard_floor_condition_arrival]}
                    onValueChange={(val) => setFormData({ ...formData, hard_floor_condition_arrival: val[0] })}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Poor</span>
                    <span>Excellent</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flooring_state">Overall Flooring State</Label>
                  <Textarea
                    id="flooring_state"
                    value={formData.flooring_state_description}
                    onChange={(e) => setFormData({ ...formData, flooring_state_description: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Safety Checks */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Safety Checks</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="swms"
                    checked={formData.has_signed_swms}
                    onChange={(e) => setFormData({ ...formData, has_signed_swms: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="swms">Signed SWMS available</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="tested"
                    checked={formData.equipment_tested_tagged}
                    onChange={(e) => setFormData({ ...formData, equipment_tested_tagged: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="tested">Equipment tested and tagged</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="clean"
                    checked={formData.equipment_clean_working}
                    onChange={(e) => setFormData({ ...formData, equipment_clean_working: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="clean">Equipment clean and working</Label>
                </div>
              </div>
            </div>

            {/* Work Description */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="work_description">Work Completed (Shared with customer) *</Label>
                <Textarea
                  id="work_description"
                  value={formData.work_description}
                  onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                  rows={4}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal_notes">Internal Notes (Not shared)</Label>
                <Textarea
                  id="internal_notes"
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            {/* Photos */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Before & After Photos</h3>
              <p className="text-sm text-muted-foreground">
                Upload after photos to match the before photos taken during the appointment.
              </p>
              <BeforeAfterPhotoUpload
                appointmentId={appointmentId}
                onPhotosChange={setPhotoPairs}
                initialPairs={photoPairs}
              />
            </div>

            {/* Problem Areas */}
            <div className="space-y-4 border-t pt-4">
              <Label>Were there any problem areas?</Label>
              <RadioGroup
                value={formData.had_problem_areas.toString()}
                onValueChange={(val) => setFormData({ ...formData, had_problem_areas: val === 'true' })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="problem-yes" />
                  <Label htmlFor="problem-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="problem-no" />
                  <Label htmlFor="problem-no">No</Label>
                </div>
              </RadioGroup>

              {formData.had_problem_areas && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="problem_description">Describe problem areas</Label>
                    <Textarea
                      id="problem_description"
                      value={formData.problem_areas_description}
                      onChange={(e) => setFormData({ ...formData, problem_areas_description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="methods">Methods attempted</Label>
                    <Textarea
                      id="methods"
                      value={formData.methods_attempted}
                      onChange={(e) => setFormData({ ...formData, methods_attempted: e.target.value })}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Incidents */}
            <div className="space-y-4 border-t pt-4">
              <Label>Was there an incident or near miss?</Label>
              <RadioGroup
                value={formData.had_incident.toString()}
                onValueChange={(val) => setFormData({ ...formData, had_incident: val === 'true' })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="incident-yes" />
                  <Label htmlFor="incident-yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="incident-no" />
                  <Label htmlFor="incident-no">No</Label>
                </div>
              </RadioGroup>

              {formData.had_incident && (
                <div className="space-y-2">
                  <Label htmlFor="incident_description">Incident description</Label>
                  <Textarea
                    id="incident_description"
                    value={formData.incident_description}
                    onChange={(e) => setFormData({ ...formData, incident_description: e.target.value })}
                    rows={4}
                  />
                </div>
              )}
            </div>

            {/* Customer Signature */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Customer Signature</h3>
              {formData.customer_signature_data ? (
                <div className="space-y-2">
                  <img src={formData.customer_signature_data} alt="Signature" className="border rounded p-2 bg-white" />
                  <Button variant="outline" onClick={() => setShowSignaturePad(true)}>
                    Update Signature
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setShowSignaturePad(true)}>
                  Capture Signature
                </Button>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Submitting...' : 'Submit Field Report'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {showSignaturePad && (
        <SignaturePad
          onSave={(signatureData) => {
            setFormData({
              ...formData,
              customer_signature_data: signatureData,
              customer_signature_name: '',
              customer_signature_date: new Date().toISOString(),
            });
            setShowSignaturePad(false);
            toast.success('Signature captured');
          }}
          onClose={() => setShowSignaturePad(false)}
        />
      )}
    </>
  );
}
