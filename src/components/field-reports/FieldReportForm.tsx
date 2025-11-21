import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Camera, Trash2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PhotoCapture from '@/components/worker/PhotoCapture';
import SignaturePad from '@/components/worker/SignaturePad';

interface FieldReportFormProps {
  appointmentId?: string;
  customerId?: string;
  locationId?: string;
  serviceOrderId?: string;
  onSave?: () => void;
}

interface Photo {
  id: string;
  file_url: string;
  file_name: string;
  photo_type: string;
  notes?: string;
  paired_photo_id?: string;
}

export default function FieldReportForm({
  appointmentId,
  customerId,
  locationId,
  serviceOrderId,
  onSave
}: FieldReportFormProps) {
  const [loading, setLoading] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  
  const [formData, setFormData] = useState({
    worker_name: '',
    service_date: new Date().toISOString().split('T')[0],
    arrival_time: '',
    work_order_number: '',
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

  const handlePhotoSave = async (file: File, category: string, notes: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError, data } = await supabase.storage
        .from('field-report-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('field-report-photos')
        .getPublicUrl(fileName);

      const newPhoto: Photo = {
        id: crypto.randomUUID(),
        file_url: publicUrl,
        file_name: file.name,
        photo_type: category,
        notes: notes || undefined,
      };

      setPhotos([...photos, newPhoto]);
      setShowPhotoCapture(false);
    } catch (error) {
      console.error('Error saving photo:', error);
      throw error;
    }
  };

  const handlePairPhotos = (photoId: string, pairedId: string) => {
    setPhotos(photos.map(p => {
      if (p.id === photoId) {
        return { ...p, paired_photo_id: pairedId };
      }
      if (p.id === pairedId) {
        return { ...p, paired_photo_id: photoId };
      }
      return p;
    }));
    toast.success('Photos paired successfully');
  };

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
          appointment_id: appointmentId,
          service_order_id: serviceOrderId,
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
      if (photos.length > 0) {
        const photoInserts = photos.map((photo, index) => ({
          tenant_id: profile.tenant_id,
          field_report_id: report.id,
          file_url: photo.file_url,
          file_name: photo.file_name,
          file_type: 'image/jpeg',
          photo_type: photo.photo_type,
          notes: photo.notes,
          display_order: index,
          paired_photo_id: photo.paired_photo_id,
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

  const beforePhotos = photos.filter(p => p.photo_type === 'before');
  const afterPhotos = photos.filter(p => p.photo_type === 'after');
  const otherPhotos = photos.filter(p => !['before', 'after'].includes(p.photo_type));

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
                <Label htmlFor="work_order_number">Work Order / Appointment Number</Label>
                <Input
                  id="work_order_number"
                  value={formData.work_order_number}
                  onChange={(e) => setFormData({ ...formData, work_order_number: e.target.value })}
                />
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Photos</h3>
                <Button onClick={() => setShowPhotoCapture(true)} size="sm">
                  <Camera className="h-4 w-4 mr-2" />
                  Add Photo
                </Button>
              </div>

              {/* Before/After Pairs */}
              {beforePhotos.length > 0 && (
                <div className="space-y-2">
                  <Label>Before & After Photos</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {beforePhotos.map(beforePhoto => {
                      const pairedAfter = afterPhotos.find(a => a.id === beforePhoto.paired_photo_id);
                      return (
                        <div key={beforePhoto.id} className="space-y-2">
                          <div className="relative">
                            <img src={beforePhoto.file_url} alt="Before" className="w-full h-48 object-cover rounded" />
                            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
                              Before
                            </div>
                          </div>
                          {pairedAfter ? (
                            <div className="relative">
                              <img src={pairedAfter.file_url} alt="After" className="w-full h-48 object-cover rounded" />
                              <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                                After
                              </div>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed rounded h-48 flex items-center justify-center">
                              <div className="text-center text-sm text-muted-foreground">
                                <p>No after photo</p>
                                {afterPhotos.filter(a => !a.paired_photo_id).length > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-2"
                                    onClick={() => {
                                      const unpaired = afterPhotos.find(a => !a.paired_photo_id);
                                      if (unpaired) handlePairPhotos(beforePhoto.id, unpaired.id);
                                    }}
                                  >
                                    <LinkIcon className="h-3 w-3 mr-1" />
                                    Link
                                  </Button>
                                )}
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
              {otherPhotos.length > 0 && (
                <div className="space-y-2">
                  <Label>Other Photos</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {otherPhotos.map(photo => (
                      <div key={photo.id} className="relative">
                        <img src={photo.file_url} alt={photo.photo_type} className="w-full h-32 object-cover rounded" />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1"
                          onClick={() => setPhotos(photos.filter(p => p.id !== photo.id))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  <Label htmlFor="incident_description">Describe incident</Label>
                  <Textarea
                    id="incident_description"
                    value={formData.incident_description}
                    onChange={(e) => setFormData({ ...formData, incident_description: e.target.value })}
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Customer Signature */}
            <div className="space-y-4 border-t pt-4">
              <Label>Customer Signature</Label>
              {formData.customer_signature_data ? (
                <div className="space-y-2">
                  <img src={formData.customer_signature_data} alt="Signature" className="border rounded h-32" />
                  <Button variant="outline" size="sm" onClick={() => setFormData({ ...formData, customer_signature_data: '' })}>
                    Clear Signature
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setShowSignaturePad(true)} variant="outline">
                  Capture Signature
                </Button>
              )}
              {formData.customer_signature_data && (
                <div className="space-y-2">
                  <Label htmlFor="sig_name">Customer Name</Label>
                  <Input
                    id="sig_name"
                    value={formData.customer_signature_name}
                    onChange={(e) => setFormData({ ...formData, customer_signature_name: e.target.value })}
                  />
                </div>
              )}
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
              {loading ? 'Submitting...' : 'Submit Field Report'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {showPhotoCapture && (
        <PhotoCapture
          onSave={handlePhotoSave}
          onClose={() => setShowPhotoCapture(false)}
        />
      )}

      {showSignaturePad && (
        <SignaturePad
          onSave={(signature) => {
            setFormData({
              ...formData,
              customer_signature_data: signature,
              customer_signature_date: new Date().toISOString(),
            });
            setShowSignaturePad(false);
          }}
          onClose={() => setShowSignaturePad(false)}
        />
      )}
    </>
  );
}
