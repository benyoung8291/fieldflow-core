import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, MapPin, Square, Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Markup } from "./FloorPlanViewer";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FloorPlanMarkupListProps {
  markups: Markup[];
  onMarkupUpdate: (id: string, notes: string) => void;
  onMarkupPhotoUpdate: (id: string, photo: File | string | null) => void;
  onMarkupDelete: (id: string) => void;
  selectedMarkupId: string | null;
  onMarkupSelect: (id: string) => void;
  uploadingPhotos?: Set<string>;
}

export function FloorPlanMarkupList({
  markups,
  onMarkupUpdate,
  onMarkupPhotoUpdate,
  onMarkupDelete,
  selectedMarkupId,
  onMarkupSelect,
  uploadingPhotos = new Set(),
}: FloorPlanMarkupListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentMarkupId, setCurrentMarkupId] = useState<string | null>(null);

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          const maxDimension = 1920;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
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
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const uploadToStorage = async (file: File, markupId: string): Promise<string> => {
    const fileExt = 'jpg';
    const fileName = `${markupId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('ticket-markups')
      .upload(filePath, file, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('ticket-markups')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, markupId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    try {
      toast.loading("Compressing image...", { id: `compress-${markupId}` });
      const compressedFile = await compressImage(file);
      toast.dismiss(`compress-${markupId}`);
      
      // Start background upload
      toast.loading("Uploading photo...", { id: `upload-${markupId}` });
      const publicUrl = await uploadToStorage(compressedFile, markupId);
      toast.success("Photo uploaded", { id: `upload-${markupId}` });
      
      onMarkupPhotoUpdate(markupId, publicUrl);
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error("Failed to process image", { id: `upload-${markupId}` });
    }
  };

  const getPhotoPreview = (photo: File | string | undefined): string | null => {
    if (!photo) return null;
    if (typeof photo === 'string') return photo;
    return URL.createObjectURL(photo);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Markups ({markups.length})</h3>
      </div>

      {markups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Tap on the floor plan to add pins or drag to draw areas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {markups.map((markup, index) => {
            const photoPreview = getPhotoPreview(markup.photo);
            
            return (
              <Card
                key={markup.id}
                className={cn(
                  "transition-all cursor-pointer hover:shadow-md",
                  selectedMarkupId === markup.id && "ring-2 ring-primary"
                )}
                onClick={() => onMarkupSelect(markup.id)}
              >
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {markup.type === "pin" ? (
                        <MapPin className="h-4 w-4 text-destructive flex-shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      )}
                      <span className="font-semibold text-sm">
                        {markup.type === "pin" ? "Pin" : "Area"} #{index + 1}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkupDelete(markup.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    <Label htmlFor={`note-${markup.id}`} className="text-xs">
                      Description
                    </Label>
                    <Input
                      id={`note-${markup.id}`}
                      value={markup.notes || ""}
                      onChange={(e) => onMarkupUpdate(markup.id, e.target.value)}
                      placeholder="Describe the issue..."
                      className="text-sm h-8 mt-1"
                    />
                  </div>

                  {/* Photo section */}
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Label className="text-xs">Photo (optional)</Label>
                    {uploadingPhotos.has(markup.id) ? (
                      <div className="flex items-center justify-center h-24 border border-border rounded-lg bg-muted">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Uploading...</span>
                        </div>
                      </div>
                    ) : photoPreview ? (
                      <div className="relative rounded-lg overflow-hidden border border-border">
                        <img
                          src={photoPreview}
                          alt="Markup photo"
                          className="w-full h-24 object-cover"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkupPhotoUpdate(markup.id, null);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentMarkupId(markup.id);
                          fileInputRef.current?.click();
                        }}
                      >
                        <ImageIcon className="h-3 w-3 mr-2" />
                        Add Photo
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (currentMarkupId) {
            handleFileSelect(e, currentMarkupId);
            setCurrentMarkupId(null);
          }
        }}
      />
    </div>
  );
}
