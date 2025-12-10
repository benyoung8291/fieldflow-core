import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

import BeforeAfterPhotoUpload from './BeforeAfterPhotoUpload';
import { Save, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FieldReportFormProps {
  appointmentId?: string;
  customerId?: string;
  locationId?: string;
  serviceOrderId?: string;
  reportId?: string; // For editing existing reports
  onSave?: () => void;
  beforePhotosCount?: number;
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
  reportId,
  onSave,
  beforePhotosCount = 0
}: FieldReportFormProps) {
  const [loading, setLoading] = useState(false);
  
  const [photoPairs, setPhotoPairs] = useState<PhotoPair[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftReportId, setDraftReportId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  
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

  // Load saved draft from local storage and database on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        // If reportId is provided, load that specific report for editing
        if (reportId) {
          const { data: existingReport } = await supabase
            .from('field_reports')
            .select('*')
            .eq('id', reportId)
            .single();
            
          if (existingReport) {
            setDraftReportId(existingReport.id);
            setIsApproved(existingReport.status === 'approved');
            setFormData(prev => ({
              ...prev,
              worker_name: existingReport.worker_name || prev.worker_name,
              service_date: existingReport.service_date,
              arrival_time: existingReport.arrival_time,
              appointment_id: existingReport.appointment_id || '',
              service_order_id: existingReport.service_order_id || '',
              carpet_condition_arrival: existingReport.carpet_condition_arrival || 3,
              hard_floor_condition_arrival: existingReport.hard_floor_condition_arrival || 3,
              flooring_state_description: existingReport.flooring_state_description || '',
              has_signed_swms: existingReport.has_signed_swms,
              equipment_tested_tagged: existingReport.equipment_tested_tagged,
              equipment_clean_working: existingReport.equipment_clean_working,
              work_description: existingReport.work_description,
              internal_notes: existingReport.internal_notes || '',
              had_problem_areas: existingReport.had_problem_areas,
              problem_areas_description: existingReport.problem_areas_description || '',
              methods_attempted: existingReport.methods_attempted || '',
              had_incident: existingReport.had_incident,
              incident_description: existingReport.incident_description || '',
              customer_signature_data: existingReport.customer_signature_data || '',
              customer_signature_name: existingReport.customer_signature_name || '',
              customer_signature_date: existingReport.customer_signature_date || '',
            }));
            
            // Load photos from database
            const { data: photos } = await supabase
              .from('field_report_photos')
              .select('*')
              .eq('field_report_id', existingReport.id)
              .order('display_order');
                
            if (photos && photos.length > 0) {
              const pairMap = new Map<number, PhotoPair>();
              
              photos.forEach((photo) => {
                const photoData = {
                  fileUrl: photo.file_url,
                  preview: photo.file_url,
                  notes: photo.notes || '',
                  fileName: photo.file_name,
                };
                
                const pairIndex = Math.floor(photo.display_order / 2);
                
                if (!pairMap.has(pairIndex)) {
                  pairMap.set(pairIndex, { id: crypto.randomUUID() });
                }
                
                const pair = pairMap.get(pairIndex)!;
                
                if (photo.photo_type === 'before') {
                  pair.before = photoData;
                } else if (photo.photo_type === 'after') {
                  pair.after = photoData;
                }
              });
              
              const pairs = Array.from(pairMap.entries())
                .sort(([a], [b]) => a - b)
                .map(([_, pair]) => pair);
              
              if (pairs.length > 0) {
                setPhotoPairs(pairs);
              }
            }
            
            setLastSaved(existingReport.updated_at ? new Date(existingReport.updated_at) : null);
            return;
          }
        }
        
        // First check database for existing draft by appointment_id
        if (appointmentId) {
          const { data: existingDraft } = await supabase
            .from('field_reports')
            .select('*')
            .eq('appointment_id', appointmentId)
            .eq('status', 'draft')
            .maybeSingle();
            
          if (existingDraft) {
            // Load the draft report data
            setDraftReportId(existingDraft.id);
            setFormData(prev => ({
              ...prev,
              worker_name: existingDraft.worker_name || prev.worker_name,
              service_date: existingDraft.service_date,
              arrival_time: existingDraft.arrival_time,
              appointment_id: existingDraft.appointment_id || '',
              service_order_id: existingDraft.service_order_id || '',
              carpet_condition_arrival: existingDraft.carpet_condition_arrival || 3,
              hard_floor_condition_arrival: existingDraft.hard_floor_condition_arrival || 3,
              flooring_state_description: existingDraft.flooring_state_description || '',
              has_signed_swms: existingDraft.has_signed_swms,
              equipment_tested_tagged: existingDraft.equipment_tested_tagged,
              equipment_clean_working: existingDraft.equipment_clean_working,
              work_description: existingDraft.work_description,
              internal_notes: existingDraft.internal_notes || '',
              had_problem_areas: existingDraft.had_problem_areas,
              problem_areas_description: existingDraft.problem_areas_description || '',
              methods_attempted: existingDraft.methods_attempted || '',
              had_incident: existingDraft.had_incident,
              incident_description: existingDraft.incident_description || '',
              customer_signature_data: existingDraft.customer_signature_data || '',
              customer_signature_name: existingDraft.customer_signature_name || '',
              customer_signature_date: existingDraft.customer_signature_date || '',
            }));
            
            // Load photos from database
            const { data: photos } = await supabase
              .from('field_report_photos')
              .select('*')
              .eq('field_report_id', existingDraft.id)
              .order('display_order');
                
            if (photos && photos.length > 0) {
              // Reconstruct photo pairs from database using display_order
              // Photos are saved with display_order: index*2 (before) and index*2+1 (after)
              const pairMap = new Map<number, PhotoPair>();
              
              photos.forEach((photo) => {
                const photoData = {
                  fileUrl: photo.file_url,
                  preview: photo.file_url,
                  notes: photo.notes || '',
                  fileName: photo.file_name,
                };
                
                // Calculate pair index from display_order
                const pairIndex = Math.floor(photo.display_order / 2);
                
                if (!pairMap.has(pairIndex)) {
                  pairMap.set(pairIndex, { id: crypto.randomUUID() });
                }
                
                const pair = pairMap.get(pairIndex)!;
                
                if (photo.photo_type === 'before') {
                  pair.before = photoData;
                } else if (photo.photo_type === 'after') {
                  pair.after = photoData;
                }
              });
              
              // Convert map to array, sorted by pair index
              const pairs = Array.from(pairMap.entries())
                .sort(([a], [b]) => a - b)
                .map(([_, pair]) => pair);
              
              if (pairs.length > 0) {
                setPhotoPairs(pairs);
              }
            }
            
            setLastSaved(existingDraft.updated_at ? new Date(existingDraft.updated_at) : null);
            toast.info('Draft restored', {
              description: 'Your previous work has been restored'
            });
            return;
          }
        }
        
        // Fallback to localStorage if no DB draft found
        const savedDraft = localStorage.getItem(storageKey);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          setFormData(parsed.formData);
          if (parsed.photoPairs) {
            setPhotoPairs(parsed.photoPairs);
          }
          if (parsed.draftReportId) {
            setDraftReportId(parsed.draftReportId);
          }
          setLastSaved(new Date(parsed.savedAt));
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    };
    
    loadDraft();
  }, [appointmentId, storageKey, reportId]);

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
          
          // Build the data object with only valid database columns
          const reportData = {
            worker_name: formData.worker_name,
            service_date: formData.service_date,
            arrival_time: formData.arrival_time,
            appointment_id: formData.appointment_id || null,
            service_order_id: formData.service_order_id || null,
            customer_id: customerId || null,
            location_id: locationId || null,
            carpet_condition_arrival: formData.carpet_condition_arrival,
            hard_floor_condition_arrival: formData.hard_floor_condition_arrival,
            flooring_state_description: formData.flooring_state_description,
            has_signed_swms: formData.has_signed_swms,
            equipment_tested_tagged: formData.equipment_tested_tagged,
            equipment_clean_working: formData.equipment_clean_working,
            work_description: formData.work_description,
            internal_notes: formData.internal_notes,
            had_problem_areas: formData.had_problem_areas,
            problem_areas_description: formData.problem_areas_description,
            methods_attempted: formData.methods_attempted,
            had_incident: formData.had_incident,
            incident_description: formData.incident_description,
            customer_signature_data: formData.customer_signature_data,
            customer_signature_name: formData.customer_signature_name,
            customer_signature_date: formData.customer_signature_date,
          };
          
          if (draftReportId) {
            // Update existing draft
            await supabase
              .from('field_reports')
              .update(reportData)
              .eq('id', draftReportId);
              
            // Save/update photo records for draft
            if (photoPairs.length > 0) {
              // Delete existing photos first
              await supabase
                .from('field_report_photos')
                .delete()
                .eq('field_report_id', draftReportId);
                
              // Step 1: Insert all photos without paired_photo_id
              const photoInserts: any[] = [];
              photoPairs.forEach((pair, index) => {
                if (pair.before) {
                  photoInserts.push({
                    tenant_id: profile.tenant_id,
                    field_report_id: draftReportId,
                    file_url: pair.before.fileUrl,
                    file_name: pair.before.fileName,
                    file_type: 'image/jpeg',
                    photo_type: 'before',
                    notes: pair.before.notes,
                    display_order: index * 2,
                    uploaded_by: user.id,
                  });
                }
                if (pair.after) {
                  photoInserts.push({
                    tenant_id: profile.tenant_id,
                    field_report_id: draftReportId,
                    file_url: pair.after.fileUrl,
                    file_name: pair.after.fileName,
                    file_type: 'image/jpeg',
                    photo_type: 'after',
                    notes: pair.after.notes,
                    display_order: index * 2 + 1,
                    uploaded_by: user.id,
                  });
                }
              });
              
              if (photoInserts.length > 0) {
                const { data: insertedPhotos } = await supabase
                  .from('field_report_photos')
                  .insert(photoInserts)
                  .select('id, file_url, photo_type');
                  
                // Step 2: Update paired_photo_id for paired photos
                if (insertedPhotos) {
                  for (const pair of photoPairs) {
                    if (pair.before && pair.after) {
                      const beforePhoto = insertedPhotos.find(
                        p => p.file_url === pair.before?.fileUrl && p.photo_type === 'before'
                      );
                      const afterPhoto = insertedPhotos.find(
                        p => p.file_url === pair.after?.fileUrl && p.photo_type === 'after'
                      );
                      
                      if (beforePhoto && afterPhoto) {
                        await Promise.all([
                          supabase
                            .from('field_report_photos')
                            .update({ paired_photo_id: afterPhoto.id })
                            .eq('id', beforePhoto.id),
                          supabase
                            .from('field_report_photos')
                            .update({ paired_photo_id: beforePhoto.id })
                            .eq('id', afterPhoto.id)
                        ]);
                      }
                    }
                  }
                }
              }
            }
          } else {
            // Create new draft
            const { data: newReport } = await supabase
              .from('field_reports')
              .insert({
                ...reportData,
                tenant_id: profile.tenant_id,
                report_number: reportNumber!,
                created_by: user.id,
                status: 'draft',
              })
              .select('id')
              .single();
              
            if (newReport) {
              setDraftReportId(newReport.id);
              
              // Save photo records for new draft
              if (photoPairs.length > 0) {
                const photoInserts: any[] = [];
                photoPairs.forEach((pair, index) => {
                  if (pair.before) {
                    photoInserts.push({
                      tenant_id: profile.tenant_id,
                      field_report_id: newReport.id,
                      file_url: pair.before.fileUrl,
                      file_name: pair.before.fileName,
                      file_type: 'image/jpeg',
                      photo_type: 'before',
                      notes: pair.before.notes,
                      display_order: index * 2,
                      uploaded_by: user.id,
                    });
                  }
                  if (pair.after) {
                    photoInserts.push({
                      tenant_id: profile.tenant_id,
                      field_report_id: newReport.id,
                      file_url: pair.after.fileUrl,
                      file_name: pair.after.fileName,
                      file_type: 'image/jpeg',
                      photo_type: 'after',
                      notes: pair.after.notes,
                      display_order: index * 2 + 1,
                      uploaded_by: user.id,
                    });
                  }
                });
                
                if (photoInserts.length > 0) {
                  const { data: insertedPhotos } = await supabase
                    .from('field_report_photos')
                    .insert(photoInserts)
                    .select('id, file_url, photo_type');
                    
                  // Update paired_photo_id for paired photos
                  if (insertedPhotos) {
                    for (const pair of photoPairs) {
                      if (pair.before && pair.after) {
                        const beforePhoto = insertedPhotos.find(
                          p => p.file_url === pair.before?.fileUrl && p.photo_type === 'before'
                        );
                        const afterPhoto = insertedPhotos.find(
                          p => p.file_url === pair.after?.fileUrl && p.photo_type === 'after'
                        );
                        
                        if (beforePhoto && afterPhoto) {
                          await Promise.all([
                            supabase
                              .from('field_report_photos')
                              .update({ paired_photo_id: afterPhoto.id })
                              .eq('id', beforePhoto.id),
                            supabase
                              .from('field_report_photos')
                              .update({ paired_photo_id: beforePhoto.id })
                              .eq('id', afterPhoto.id)
                          ]);
                        }
                      }
                    }
                  }
                }
              }
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

  // Auto-populate logged-in user name (only if not already set)
  useEffect(() => {
    const loadUserName = async () => {
      // Skip if worker_name is already populated
      if (formData.worker_name) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();
        if (profile?.first_name) {
          const fullName = `${profile.first_name} ${profile.last_name || ''}`.trim();
          setFormData(prev => prev.worker_name ? prev : { ...prev, worker_name: fullName });
        }
      }
    };
    loadUserName();
  }, [formData.worker_name]);

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
      
      // Build the data object with only valid database columns
      const reportData = {
        worker_name: formData.worker_name,
        service_date: formData.service_date,
        arrival_time: formData.arrival_time,
        appointment_id: formData.appointment_id || null,
        service_order_id: formData.service_order_id || null,
        customer_id: customerId || null,
        location_id: locationId || null,
        carpet_condition_arrival: formData.carpet_condition_arrival,
        hard_floor_condition_arrival: formData.hard_floor_condition_arrival,
        flooring_state_description: formData.flooring_state_description,
        has_signed_swms: formData.has_signed_swms,
        equipment_tested_tagged: formData.equipment_tested_tagged,
        equipment_clean_working: formData.equipment_clean_working,
        work_description: formData.work_description,
        internal_notes: formData.internal_notes,
        had_problem_areas: formData.had_problem_areas,
        problem_areas_description: formData.problem_areas_description,
        methods_attempted: formData.methods_attempted,
        had_incident: formData.had_incident,
        incident_description: formData.incident_description,
        customer_signature_data: formData.customer_signature_data,
        customer_signature_name: formData.customer_signature_name,
        customer_signature_date: formData.customer_signature_date,
      };
      
      if (draftReportId) {
        // Update existing draft or submitted report
        console.log('Updating report to submitted...');
        const reportNumber = report ? report.report_number : `FR-${Date.now()}`;
        const { data: updatedReport, error: updateError } = await supabase
          .from('field_reports')
          .update({
            ...reportData,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            report_number: reportNumber,
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
            ...reportData,
            tenant_id: profile.tenant_id,
            report_number: reportNumber,
            created_by: user.id,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
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
        
        // Delete existing photos first (in case they were saved during draft)
        await supabase
          .from('field_report_photos')
          .delete()
          .eq('field_report_id', report.id);
        
        // Step 1: Insert all photos without paired_photo_id
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

        const { data: insertedPhotos, error: photosError } = await supabase
          .from('field_report_photos')
          .insert(photoInserts)
          .select('id, file_url, photo_type');

        if (photosError) {
          console.error('Photo records save error:', photosError);
          throw new Error(`Failed to save photo records: ${photosError.message}`);
        }
        
        // Step 2: Update paired_photo_id for paired photos
        if (insertedPhotos) {
          for (const pair of photoPairs) {
            if (pair.before && pair.after) {
              const beforePhoto = insertedPhotos.find(
                p => p.file_url === pair.before?.fileUrl && p.photo_type === 'before'
              );
              const afterPhoto = insertedPhotos.find(
                p => p.file_url === pair.after?.fileUrl && p.photo_type === 'after'
              );
              
              if (beforePhoto && afterPhoto) {
                await Promise.all([
                  supabase
                    .from('field_report_photos')
                    .update({ paired_photo_id: afterPhoto.id })
                    .eq('id', beforePhoto.id),
                  supabase
                    .from('field_report_photos')
                    .update({ paired_photo_id: beforePhoto.id })
                    .eq('id', afterPhoto.id)
                ]);
              }
            }
          }
        }
        console.log('Photo records saved successfully');
      }

      // Clear local storage draft on successful submission (only if not editing existing report)
      if (!reportId) {
        localStorage.removeItem(storageKey);
      }
      
      console.log('Field report submission completed successfully');
      toast.success('Field report submitted successfully');
      
      // Call onSave callback to let parent handle navigation
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
            {/* Before Photos Warning */}
            {beforePhotosCount === 0 && !isApproved && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Before Photos Found</AlertTitle>
                <AlertDescription>
                  Before photos should be uploaded before creating a field report. 
                  These photos document the initial condition and are required for before/after comparisons.
                  Please go back to the appointment and upload before photos first.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Approved Notice */}
            {isApproved && (
              <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-success">
                  ✓ This report has been approved and can no longer be edited.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  To make changes, an administrator must unapprove the report first.
                </p>
              </div>
            )}
            
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="worker_name">Your Name *</Label>
                <Input
                  id="worker_name"
                  value={formData.worker_name}
                  onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })}
                  required
                  disabled={isApproved}
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
                  disabled={isApproved}
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
                  disabled={isApproved}
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
                    disabled={isApproved}
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
                    disabled={isApproved}
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
                    disabled={isApproved}
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
                    disabled={isApproved}
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
                    disabled={isApproved}
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
                    disabled={isApproved}
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
                  disabled={isApproved}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internal_notes">Internal Notes (Not shared)</Label>
                <Textarea
                  id="internal_notes"
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                  rows={3}
                  disabled={isApproved}
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

            <Button
              onClick={handleSubmit}
              disabled={loading || isApproved}
              className="w-full"
              size="lg"
            >
              {loading ? 'Submitting...' : isApproved ? 'Report Approved - Cannot Edit' : 'Submit Field Report'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
