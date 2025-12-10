import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Camera, ZoomIn, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export interface PhotoPair {
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

interface ContractorPhotoUploadProps {
  onPhotosChange: (pairs: PhotoPair[]) => void;
  initialPairs?: PhotoPair[];
  token: string;
}

export function ContractorPhotoUpload({ 
  onPhotosChange, 
  initialPairs = [],
  token 
}: ContractorPhotoUploadProps) {
  const [pairs, setPairs] = useState<PhotoPair[]>(
    initialPairs.length > 0 ? initialPairs : [{ id: crypto.randomUUID() }]
  );
  const [uploadingSlots, setUploadingSlots] = useState<Set<string>>(new Set());
  const [viewingPhoto, setViewingPhoto] = useState<{ preview: string; notes: string; index: number } | null>(null);
  const afterInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const beforeInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

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
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
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
    // Sanitize filename - replace spaces and special characters with dashes
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const fileName = `contractor/${token}/${Date.now()}-${sanitizedName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('field-report-photos')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('field-report-photos')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleFileSelect = async (pairId: string, type: 'before' | 'after', files: FileList | null) => {
    if (!files || files.length === 0) return;

    const slotKey = `${pairId}-${type}`;
    setUploadingSlots(prev => new Set(prev).add(slotKey));

    try {
      const processedFiles = await Promise.all(
        Array.from(files).map(async (file) => {
          if (!file.type.startsWith('image/')) {
            toast.error(`${file.name} is not an image`);
            return null;
          }
          
          // Compress image
          const compressed = await compressImage(file);
          
          // Upload to storage immediately (background upload)
          const fileUrl = await uploadToStorage(compressed);
          
          return { 
            fileUrl, 
            preview: fileUrl, 
            fileName: file.name 
          };
        })
      );

      const validFiles = processedFiles.filter((f): f is { fileUrl: string; preview: string; fileName: string } => f !== null);
      
      if (validFiles.length === 0) {
        setUploadingSlots(prev => {
          const next = new Set(prev);
          next.delete(slotKey);
          return next;
        });
        return;
      }

      const updatedPairs = [...pairs];
      let currentPairIndex = updatedPairs.findIndex(p => p.id === pairId);
      
      validFiles.forEach((fileData, index) => {
        if (index === 0) {
          // First file goes into the selected slot
          if (type === 'before') {
            updatedPairs[currentPairIndex].before = { ...fileData, notes: '' };
          } else {
            updatedPairs[currentPairIndex].after = { ...fileData, notes: '' };
          }
          
          // Auto-create new row if this pair is now complete and no empty row exists
          const hasEmptyPair = updatedPairs.some(p => !p.before && !p.after);
          if (updatedPairs[currentPairIndex].before && updatedPairs[currentPairIndex].after && !hasEmptyPair) {
            updatedPairs.push({ id: crypto.randomUUID() });
          }
        } else {
          // Additional files create new pairs
          const newPair: PhotoPair = { id: crypto.randomUUID() };
          if (type === 'before') {
            newPair.before = { ...fileData, notes: '' };
          } else {
            newPair.after = { ...fileData, notes: '' };
          }
          updatedPairs.push(newPair);
        }
      });

      setPairs(updatedPairs);
      onPhotosChange(updatedPairs);
      toast.success(`${validFiles.length} image(s) uploaded`);
    } catch (error) {
      console.error('Error processing images:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploadingSlots(prev => {
        const next = new Set(prev);
        next.delete(slotKey);
        return next;
      });
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

  const removePhoto = (pairId: string, type: 'before' | 'after') => {
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
    
    // Filter empty pairs but keep at least one
    const filtered = updatedPairs.filter(p => p.before || p.after || updatedPairs.length === 1);
    
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
    // Check if there's already an empty pair (no before AND no after)
    const hasEmptyPair = pairs.some(p => !p.before && !p.after);
    if (hasEmptyPair) {
      toast.info('Please fill the empty row before adding another');
      return;
    }
    
    const newPair: PhotoPair = { id: crypto.randomUUID() };
    const updatedPairs = [...pairs, newPair];
    setPairs(updatedPairs);
    onPhotosChange(updatedPairs);
  };

  const removeRow = (pairId: string) => {
    const updatedPairs = pairs.filter(p => p.id !== pairId);
    // Ensure at least one row remains
    if (updatedPairs.length === 0) {
      updatedPairs.push({ id: crypto.randomUUID() });
    }
    setPairs(updatedPairs);
    onPhotosChange(updatedPairs);
  };

  const renderPhotoSlot = (pair: PhotoPair, index: number, type: 'before' | 'after') => {
    const photo = type === 'before' ? pair.before : pair.after;
    const inputRefs = type === 'before' ? beforeInputRefs : afterInputRefs;
    const slotKey = `${pair.id}-${type}`;
    const isUploading = uploadingSlots.has(slotKey);

    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {type === 'before' ? 'Before' : 'After'} #{index + 1}
        </div>
        
        <input
          ref={el => inputRefs.current[pair.id] = el}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileSelect(pair.id, type, e.target.files)}
        />
        
        {isUploading ? (
          <div className="border-2 border-dashed rounded-lg h-48 flex flex-col items-center justify-center bg-muted/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <div className="text-sm text-muted-foreground">Uploading...</div>
          </div>
        ) : photo ? (
          <div className="space-y-2">
            <div className="relative group">
              <img 
                src={photo.preview} 
                alt={`${type} photo`}
                className="w-full h-48 object-cover rounded border cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setViewingPhoto({ preview: photo.preview, notes: photo.notes, index: index + 1 })}
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setViewingPhoto({ preview: photo.preview, notes: photo.notes, index: index + 1 })}
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removePhoto(pair.id, type)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              placeholder="Notes (optional)"
              value={photo.notes}
              onChange={(e) => updateNotes(pair.id, type, e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
        ) : (
          <div
            onDrop={(e) => handleDrop(e, pair.id, type)}
            onDragOver={handleDragOver}
            className="border-2 border-dashed rounded-lg h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => inputRefs.current[pair.id]?.click()}
          >
            <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
            <div className="text-sm text-center">
              <div className="font-medium">Drop images or click</div>
              <div className="text-xs text-muted-foreground mt-1">
                <Camera className="h-3 w-3 inline mr-1" />
                Supports multiple selection
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-2">
        Upload before photos on the left, after photos on the right. Photos are uploaded immediately as you select them.
      </div>
      
      <div className="space-y-3">
        {pairs.map((pair, index) => (
          <div key={pair.id} className="relative grid grid-cols-1 md:grid-cols-2 gap-3 p-3 border rounded-lg bg-card">
            {renderPhotoSlot(pair, index, 'before')}
            {renderPhotoSlot(pair, index, 'after')}
            
            {/* Remove row button - only show if row is empty AND there's more than one row */}
            {!pair.before && !pair.after && pairs.length > 1 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                onClick={() => removeRow(pair.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addNewPair}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Photo Pair
      </Button>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-4xl">
          <DialogTitle>Photo #{viewingPhoto?.index}</DialogTitle>
          {viewingPhoto && (
            <div className="space-y-4">
              <img 
                src={viewingPhoto.preview} 
                alt="Full size" 
                className="w-full max-h-[70vh] object-contain rounded"
              />
              {viewingPhoto.notes && (
                <div className="p-3 bg-muted rounded text-sm">
                  <span className="font-medium">Notes:</span> {viewingPhoto.notes}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
