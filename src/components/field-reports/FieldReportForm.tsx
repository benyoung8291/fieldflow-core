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
    file: File;
    preview: string;
    notes: string;
  };
  after?: {
    file: File;
    preview: string;
    notes: string;
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
  
  const [formData, setFormData] = useState({
    worker_name: '',
    service_date: new Date().toISOString().split('T')[0],
    arrival_time: '',
    linked_appointment_id: appointmentId || '',
    linked_service_order_id: serviceOrderId || '',
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Generate report number
      const reportNumber = `FR-${Date.now()}`;

      const { data: report, error: reportError } = await supabase
        .from('field_reports')
        .insert({
          tenant_id: profile.tenant_id,
          appointment_id: formData.linked_appointment_id || null,
          service_order_id: formData.linked_service_order_id || null,
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

      if (reportError) throw reportError;

      // Save photos
      const allPhotos: any[] = [];
      for (const pair of photoPairs) {
        if (pair.before) {
          const fileName = `${Date.now()}-before-${pair.before.file.name}`;
          const { data: uploadData } = await supabase.storage
            .from('field-report-photos')
            .upload(fileName, pair.before.file);
          
          if (uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('field-report-photos')
              .getPublicUrl(fileName);
            allPhotos.push({
              file_url: publicUrl,
              file_name: pair.before.file.name,
              photo_type: 'before',
              notes: pair.before.notes,
            });
          }
        }
        if (pair.after) {
          const fileName = `${Date.now()}-after-${pair.after.file.name}`;
          const { data: uploadData } = await supabase.storage
            .from('field-report-photos')
            .upload(fileName, pair.after.file);
          
          if (uploadData) {
            const { data: { publicUrl } } = supabase.storage
              .from('field-report-photos')
              .getPublicUrl(fileName);
            allPhotos.push({
              file_url: publicUrl,
              file_name: pair.after.file.name,
              photo_type: 'after',
              notes: pair.after.notes,
            });
          }
        }
      }

      if (allPhotos.length > 0) {
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

        if (photosError) throw photosError;
      }

      toast.success('Field report submitted successfully');
      onSave?.();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit field report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Field Report</CardTitle>
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
                  value={formData.linked_appointment_id}
                  onValueChange={(val) => setFormData({ ...formData, linked_appointment_id: val })}
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
                  value={formData.linked_service_order_id}
                  onValueChange={(val) => setFormData({ ...formData, linked_service_order_id: val })}
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
