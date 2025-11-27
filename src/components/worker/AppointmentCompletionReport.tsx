import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Camera, CheckCircle, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AppointmentCompletionReportProps {
  appointmentId: string;
  onComplete: () => void;
}

export function AppointmentCompletionReport({ appointmentId, onComplete }: AppointmentCompletionReportProps) {
  const [completionNotes, setCompletionNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null)[0];

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          let width = img.width;
          let height = img.height;
          const maxDimension = 1920;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Could not compress image'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('Please select image files');
      return;
    }

    try {
      toast.info('Optimizing images...');
      const compressedFiles: File[] = [];
      const newPreviews: string[] = [];

      for (const file of imageFiles) {
        const compressedFile = await compressImage(file);
        compressedFiles.push(compressedFile);
        
        const reader = new FileReader();
        const preview = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(compressedFile);
        });
        newPreviews.push(preview);
      }

      setPhotos(prev => [...prev, ...compressedFiles]);
      setPreviews(prev => [...prev, ...newPreviews]);
      toast.success(`${compressedFiles.length} photo(s) added`);
    } catch (error) {
      console.error('Error processing images:', error);
      toast.error('Failed to process images');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!completionNotes.trim()) {
      toast.error('Please add completion notes');
      return;
    }

    if (photos.length === 0) {
      toast.error('Please add at least one photo');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Upload photos
      const uploadedUrls: string[] = [];
      for (const photo of photos) {
        const fileName = `completion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
        const filePath = `${profile.tenant_id}/${appointmentId}/completion/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('appointment-attachments')
          .upload(filePath, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('appointment-attachments')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);

        // Create attachment record
        await supabase
          .from('appointment_attachments')
          .insert({
            tenant_id: profile.tenant_id,
            appointment_id: appointmentId,
            uploaded_by: user.id,
            file_name: fileName,
            file_url: publicUrl,
            file_type: 'image/jpeg',
            category: 'completion_photo',
            notes: 'Completion photo',
          });
      }

      // Update appointment with completion report
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          completion_notes: completionNotes,
          completion_reported_at: new Date().toISOString(),
          completion_reported_by: user.id,
        })
        .eq('id', appointmentId);

      if (updateError) throw updateError;

      toast.success('Completion report submitted successfully');
      onComplete();
    } catch (error: any) {
      console.error('Error submitting completion report:', error);
      toast.error(error.message || 'Failed to submit completion report');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Completion Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Completion Notes *</label>
          <Textarea
            placeholder="Describe what was completed, any issues encountered, or additional notes..."
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Completion Photos * (at least 1 required)</label>
          <input
            ref={(el) => (fileInputRef as any) = el}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          {previews.length === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={() => fileInputRef?.click()}
                variant="outline"
                className="h-32 flex-col gap-2"
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm">Take Photos</span>
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (fileInputRef) {
                    fileInputRef.removeAttribute('capture');
                    fileInputRef.click();
                  }
                }}
                variant="outline"
                className="h-32 flex-col gap-2"
              >
                <Upload className="h-8 w-8" />
                <span className="text-sm">Choose Photos</span>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {previews.map((preview, index) => (
                  <div key={index} className="relative rounded-lg overflow-hidden border">
                    <img
                      src={preview}
                      alt={`Completion photo ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 h-7 w-7 p-0"
                      onClick={() => removePhoto(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={() => fileInputRef?.click()}
                variant="outline"
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                Add More Photos
              </Button>
            </>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={uploading || !completionNotes.trim() || photos.length === 0}
          className="w-full"
          size="lg"
        >
          {uploading ? 'Submitting...' : 'Submit Completion Report'}
        </Button>
      </CardContent>
    </Card>
  );
}
