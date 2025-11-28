import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, MapPin, Square, Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Markup } from "../FloorPlanViewer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MobileMarkupSheetProps {
  markups: Markup[];
  selectedMarkupId: string | null;
  onMarkupSelect: (id: string | null) => void;
  onMarkupUpdate: (id: string, notes: string) => void;
  onMarkupPhotoUpdate: (id: string, photo: File | string | null) => void;
  onMarkupDelete: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadingPhotos?: Set<string>;
}

export function MobileMarkupSheet({
  markups,
  selectedMarkupId,
  onMarkupSelect,
  onMarkupUpdate,
  onMarkupPhotoUpdate,
  onMarkupDelete,
  open,
  onOpenChange,
  uploadingPhotos = new Set(),
}: MobileMarkupSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] max-w-[95vw] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-4 py-4 border-b shrink-0">
          <DialogTitle className="text-xl">Markup List</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-4">
          <div className="py-4">
            {markups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">No markups yet</p>
                <p className="text-sm">Tap the pin or area button to add markups</p>
              </div>
            ) : (
              <div className="space-y-3">
                {markups.map((markup, index) => {
                  const photoPreview = getPhotoPreview(markup.photo);
                  
                  return (
                    <Card
                      key={markup.id}
                      className={cn(
                        "p-4 transition-all cursor-pointer",
                        selectedMarkupId === markup.id && "ring-2 ring-primary shadow-lg"
                      )}
                      onClick={() => onMarkupSelect(markup.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {markup.type === "pin" ? (
                            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                              <MapPin className="h-5 w-5 text-destructive" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                              <Square className="h-5 w-5 text-yellow-600" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-semibold">
                              #{index + 1}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {markup.type === "pin" ? "Pin" : "Area"}
                            </span>
                          </div>
                          
                          <Input
                            placeholder="Describe the issue..."
                            value={markup.notes || ""}
                            onChange={(e) => {
                              e.stopPropagation();
                              onMarkupUpdate(markup.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-base"
                          />

                          {/* Photo section */}
                          <div className="space-y-2">
                            {uploadingPhotos.has(markup.id) ? (
                              <div className="flex items-center justify-center h-32 border border-border rounded-lg bg-muted">
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                  <span className="text-sm text-muted-foreground">Uploading...</span>
                                </div>
                              </div>
                            ) : photoPreview ? (
                              <div className="relative rounded-lg overflow-hidden border border-border">
                                <img
                                  src={photoPreview}
                                  alt="Markup photo"
                                  className="w-full h-32 object-cover"
                                />
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="absolute top-2 right-2 h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkupPhotoUpdate(markup.id, null);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentMarkupId(markup.id);
                                    cameraInputRef.current?.click();
                                  }}
                                >
                                  <Camera className="h-4 w-4 mr-2" />
                                  Take Photo
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentMarkupId(markup.id);
                                    fileInputRef.current?.click();
                                  }}
                                >
                                  <ImageIcon className="h-4 w-4 mr-2" />
                                  Gallery
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkupDelete(markup.id);
                          }}
                          className="flex-shrink-0 h-10 w-10"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
      
      {/* Hidden file inputs */}
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
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (currentMarkupId) {
            handleFileSelect(e, currentMarkupId);
            setCurrentMarkupId(null);
          }
        }}
      />
    </Dialog>
  );
}
