import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Camera, Image as ImageIcon, ZoomIn, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useNativeCamera, photoToFile } from '@/hooks/useNativeCamera';

interface PhotoPair {
  id: string;
  before?: {
    fileUrl: string;
    preview: string;
    notes: string;
    fileName: string;
  };
  after?: {
    fileUrl: string;
    preview: string;
    notes: string;
    fileName: string;
  };
}

interface BeforeAfterPhotoUploadProps {
  onPhotosChange: (pairs: PhotoPair[]) => void;
  initialPairs?: PhotoPair[];
  appointmentId?: string;
}

export default function BeforeAfterPhotoUpload({ 
  onPhotosChange, 
  initialPairs = [],
  appointmentId 
}: BeforeAfterPhotoUploadProps) {
  const [pairs, setPairs] = useState<PhotoPair[]>(initialPairs.length > 0 ? initialPairs : [{ id: crypto.randomUUID() }]);
  const [loading, setLoading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<{ preview: string; notes: string; index: number } | null>(null);
  
  // Separate refs for camera and gallery inputs
  const beforeCameraRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const beforeGalleryRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const afterCameraRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const afterGalleryRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // Native camera hook
  const { takePhoto: nativeTakePhoto, pickFromGallery: nativePickGallery, isAvailable: isNativeAvailable } = useNativeCamera();

  // Sync pairs with initialPairs when they change (e.g., draft restored from localStorage)
  useEffect(() => {
    if (initialPairs.length > 0) {
      setPairs(initialPairs);
    }
  }, [initialPairs]);

  // ALWAYS load before photos from appointment when appointmentId is provided
  useEffect(() => {
    if (appointmentId) {
      loadBeforePhotosAndMerge();
    }
  }, [appointmentId]);

  const loadBeforePhotosAndMerge = async () => {
    if (!appointmentId) return;
    
    try {
      setLoading(true);
      const { data: attachments, error } = await supabase
        .from('appointment_attachments')
        .select('*')
        .eq('appointment_id', appointmentId)
        .eq('category', 'before_photo')
        .order('uploaded_at', { ascending: true });

      if (error) throw error;

      if (attachments && attachments.length > 0) {
        const loadedPairs: PhotoPair[] = attachments.map((attachment) => ({
          id: attachment.id,
          before: {
            fileUrl: attachment.file_url,
            preview: attachment.file_url,
            notes: attachment.notes || '',
            fileName: attachment.file_name,
          },
        }));
        
        if (initialPairs.length > 0) {
          initialPairs.forEach((existingPair, index) => {
            if (existingPair.after && loadedPairs[index]) {
              loadedPairs[index].after = existingPair.after;
            }
          });
        }
        
        setPairs(loadedPairs);
        onPhotosChange(loadedPairs);
      }
    } catch (error) {
      console.error('Error loading before photos:', error);
      toast.error('Failed to load before photos');
    } finally {
      setLoading(false);
    }
  };

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

  const uploadToStorage = async (file: File): Promise<string> => {
    const fileName = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('field-report-photos')
      .upload(fileName, file);
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('field-report-photos')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const processAndUploadFile = async (pairId: string, type: 'before' | 'after', file: File) => {
    try {
      toast.info('Processing and uploading image...');
      
      const compressed = await compressImage(file);
      const fileUrl = await uploadToStorage(compressed);
      
      const fileData = { 
        fileUrl, 
        preview: fileUrl, 
        fileName: file.name,
        notes: ''
      };

      const updatedPairs = [...pairs];
      const currentPairIndex = updatedPairs.findIndex(p => p.id === pairId);
      
      if (currentPairIndex === -1) return;
      
      if (type === 'before') {
        updatedPairs[currentPairIndex].before = fileData;
      } else {
        updatedPairs[currentPairIndex].after = fileData;
      }
      
      if (!appointmentId && updatedPairs[currentPairIndex].before && updatedPairs[currentPairIndex].after) {
        updatedPairs.push({ id: crypto.randomUUID() });
      }

      setPairs(updatedPairs);
      onPhotosChange(updatedPairs);
      toast.success('Image uploaded');
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to upload image');
    }
  };

  // Native camera handlers
  const handleNativeTakePhoto = async (pairId: string, type: 'before' | 'after') => {
    const photo = await nativeTakePhoto();
    if (photo) {
      const file = await photoToFile(photo);
      if (file) {
        await processAndUploadFile(pairId, type, file);
      }
    }
  };

  const handleNativePickGallery = async (pairId: string, type: 'before' | 'after') => {
    const photo = await nativePickGallery();
    if (photo) {
      const file = await photoToFile(photo);
      if (file) {
        await processAndUploadFile(pairId, type, file);
      }
    }
  };

  const handleFileSelect = async (pairId: string, type: 'before' | 'after', files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      toast.info('Processing and uploading images...');
      
      const processedFiles = await Promise.all(
        Array.from(files).map(async (file) => {
          if (!file.type.startsWith('image/')) {
            toast.error(`${file.name} is not an image`);
            return null;
          }
          
          const compressed = await compressImage(file);
          const fileUrl = await uploadToStorage(compressed);
          
          return { 
            fileUrl, 
            preview: fileUrl, 
            fileName: file.name 
          };
        })
      );

      const validFiles = processedFiles.filter((f): f is { fileUrl: string; preview: string; fileName: string } => f !== null);
      
      if (validFiles.length === 0) return;

      const updatedPairs = [...pairs];
      const currentPairIndex = updatedPairs.findIndex(p => p.id === pairId);
      
      validFiles.forEach((fileData, index) => {
        if (index === 0) {
          if (type === 'before') {
            updatedPairs[currentPairIndex].before = { ...fileData, notes: '' };
          } else {
            updatedPairs[currentPairIndex].after = { ...fileData, notes: '' };
          }
          
          if (!appointmentId && updatedPairs[currentPairIndex].before && updatedPairs[currentPairIndex].after) {
            updatedPairs.push({ id: crypto.randomUUID() });
          }
        } else {
          if (!appointmentId) {
            const newPair: PhotoPair = { id: crypto.randomUUID() };
            if (type === 'before') {
              newPair.before = { ...fileData, notes: '' };
            } else {
              newPair.after = { ...fileData, notes: '' };
            }
            updatedPairs.push(newPair);
          }
        }
      });

      setPairs(updatedPairs);
      onPhotosChange(updatedPairs);
      toast.success(`${validFiles.length} image(s) uploaded`);
    } catch (error) {
      console.error('Error processing images:', error);
      toast.error('Failed to upload images');
    }
  };

  const handleDrop = async (e: React.DragEvent, pairId: string, type: 'before' | 'after') => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    await handleFileSelect(pairId, type, files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removePhoto = async (pairId: string, type: 'before' | 'after') => {
    const pair = pairs.find(p => p.id === pairId);
    
    if (type === 'after' && pair?.after?.fileUrl) {
      try {
        const { error } = await supabase
          .from('field_report_photos')
          .delete()
          .eq('file_url', pair.after.fileUrl);
        
        if (error) {
          console.error('Error deleting photo from database:', error);
        }
      } catch (error) {
        console.error('Error deleting photo:', error);
      }
    }
    
    const updatedPairs = pairs.map(p => {
      if (p.id === pairId) {
        const updated = { ...p };
        if (type === 'before') {
          delete updated.before;
        } else {
          delete updated.after;
        }
        return updated;
      }
      return p;
    });
    
    const filtered = appointmentId 
      ? updatedPairs
      : updatedPairs.filter(p => p.before || p.after || updatedPairs.length === 1);
    
    setPairs(filtered.length > 0 ? filtered : [{ id: crypto.randomUUID() }]);
    onPhotosChange(filtered);
  };

  const updateNotes = (pairId: string, type: 'before' | 'after', notes: string) => {
    const updatedPairs = pairs.map(pair => {
      if (pair.id === pairId) {
        if (type === 'before' && pair.before) {
          return { ...pair, before: { ...pair.before, notes } };
        }
        if (type === 'after' && pair.after) {
          return { ...pair, after: { ...pair.after, notes } };
        }
      }
      return pair;
    });
    setPairs(updatedPairs);
    onPhotosChange(updatedPairs);
  };

  const addNewPair = () => {
    const newPair: PhotoPair = { id: crypto.randomUUID() };
    const updatedPairs = [...pairs, newPair];
    setPairs(updatedPairs);
    onPhotosChange(updatedPairs);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (appointmentId && pairs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No before photos available</p>
        <p className="text-xs mt-1">Before photos must be added during the appointment</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {appointmentId ? (
        <div className="text-sm text-muted-foreground mb-2">
          Upload after photos to match each before photo from the appointment.
        </div>
      ) : (
        <div className="text-sm text-muted-foreground mb-2">
          Upload before photos on the left, after photos on the right.
        </div>
      )}
      
      <div className="space-y-3">
        {pairs.map((pair, index) => (
          <div key={pair.id} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 border rounded-lg bg-card">
            {/* Before Photo */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Before #{index + 1}</div>
              
              {!appointmentId && (
                <>
                  <input
                    ref={el => beforeCameraRefs.current[pair.id] = el}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileSelect(pair.id, 'before', e.target.files)}
                  />
                  <input
                    ref={el => beforeGalleryRefs.current[pair.id] = el}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(pair.id, 'before', e.target.files)}
                  />
                </>
              )}
              
              {pair.before ? (
                <div className="space-y-2">
                  <div className="relative group">
                    <img 
                      src={pair.before.preview} 
                      alt="Before" 
                      className="w-full h-48 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setViewingPhoto({ preview: pair.before!.preview, notes: pair.before!.notes, index: index + 1 })}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setViewingPhoto({ preview: pair.before!.preview, notes: pair.before!.notes, index: index + 1 })}
                    >
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                    {!appointmentId && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removePhoto(pair.id, 'before')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {appointmentId && pair.before.notes && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      {pair.before.notes}
                    </div>
                  )}
                  {!appointmentId && (
                    <Textarea
                      placeholder="Notes (optional)"
                      value={pair.before.notes}
                      onChange={(e) => updateNotes(pair.id, 'before', e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  )}
                </div>
              ) : (
                !appointmentId && (
                  <div
                    onDrop={(e) => handleDrop(e, pair.id, 'before')}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed rounded-lg h-48 flex flex-col items-center justify-center gap-3 p-3"
                  >
                    <div className="text-sm text-muted-foreground">Add before photo</div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => isNativeAvailable 
                          ? handleNativeTakePhoto(pair.id, 'before') 
                          : beforeCameraRefs.current[pair.id]?.click()
                        }
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        Camera
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => isNativeAvailable
                          ? handleNativePickGallery(pair.id, 'before')
                          : beforeGalleryRefs.current[pair.id]?.click()
                        }
                      >
                        <ImageIcon className="h-4 w-4 mr-1" />
                        Gallery
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">Or drag & drop</div>
                  </div>
                )
              )}
            </div>

            {/* After Photo */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">After #{index + 1}</div>
              
              <input
                ref={el => afterCameraRefs.current[pair.id] = el}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelect(pair.id, 'after', e.target.files)}
              />
              <input
                ref={el => afterGalleryRefs.current[pair.id] = el}
                type="file"
                accept="image/*"
                multiple={!appointmentId}
                className="hidden"
                onChange={(e) => handleFileSelect(pair.id, 'after', e.target.files)}
              />
              
              {pair.after ? (
                <div className="space-y-2">
                  <div className="relative group">
                    <img 
                      src={pair.after.preview} 
                      alt="After" 
                      className="w-full h-48 object-cover rounded border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(pair.id, 'after')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Notes (optional)"
                    value={pair.after.notes}
                    onChange={(e) => updateNotes(pair.id, 'after', e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              ) : (
                <div
                  onDrop={(e) => handleDrop(e, pair.id, 'after')}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed rounded-lg h-48 flex flex-col items-center justify-center gap-3 p-3"
                >
                  <div className="text-sm text-muted-foreground">Add after photo</div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => isNativeAvailable 
                        ? handleNativeTakePhoto(pair.id, 'after') 
                        : afterCameraRefs.current[pair.id]?.click()
                      }
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Camera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => isNativeAvailable
                        ? handleNativePickGallery(pair.id, 'after')
                        : afterGalleryRefs.current[pair.id]?.click()
                      }
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Gallery
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">Or drag & drop</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!appointmentId && (
        <Button
          type="button"
          variant="outline"
          onClick={addNewPair}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Photo Pair
        </Button>
      )}

      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh]">
          <DialogTitle>Before Photo #{viewingPhoto?.index}</DialogTitle>
          <div className="space-y-4">
            <div className="relative w-full overflow-auto">
              <img 
                src={viewingPhoto?.preview} 
                alt="Before photo enlarged" 
                className="w-full h-auto object-contain max-h-[70vh]"
              />
            </div>
            {viewingPhoto?.notes && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Notes:</p>
                <p className="text-sm text-muted-foreground">{viewingPhoto.notes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
