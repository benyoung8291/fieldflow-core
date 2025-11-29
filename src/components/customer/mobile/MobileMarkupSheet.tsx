import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, MapPin, Square, Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Markup } from "../FloorPlanViewer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
      <DialogContent 
        className="h-[85vh] max-w-[95vw] p-0 gap-0 flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-3 py-3 border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <DialogTitle className="text-base font-semibold">Markups ({markups.length})</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-3 pb-6 min-h-full">{markups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm mb-1">No markups yet</p>
                <p className="text-xs">Tap pin or area to add</p>
              </div>
            ) : (
              <div className="space-y-2">
                {markups.map((markup, index) => {
                  const photoPreview = getPhotoPreview(markup.photo);
                  
                  return (
                    <Card
                      key={markup.id}
                      className={cn(
                        "p-2.5 transition-all",
                        selectedMarkupId === markup.id && "ring-2 ring-primary"
                      )}
                    >
                      <div className="space-y-2">
                        {/* Header with icon, number, and delete */}
                        <div className="flex items-center gap-2">
                          {markup.type === "pin" ? (
                            <div className="h-7 w-7 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                              <MapPin className="h-3.5 w-3.5 text-destructive" />
                            </div>
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                              <Square className="h-3.5 w-3.5 text-yellow-600" />
                            </div>
                          )}
                          
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            #{index + 1}
                          </Badge>
                          
                          <span className="text-xs text-muted-foreground">
                            {markup.type === "pin" ? "Pin" : "Area"}
                          </span>
                          
                          <div className="flex-1" />
                          
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkupDelete(markup.id);
                            }}
                            className="h-7 w-7 shrink-0"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        
                        {/* Description input */}
                        <Input
                          placeholder="Describe issue..."
                          value={markup.notes || ""}
                          onChange={(e) => {
                            e.stopPropagation();
                            onMarkupUpdate(markup.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-9 text-sm"
                        />

                        {/* Compact photo section */}
                        {uploadingPhotos.has(markup.id) ? (
                          <div className="flex items-center justify-center h-20 border border-dashed border-border rounded-md bg-muted/50">
                            <div className="flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                              <span className="text-xs text-muted-foreground">Uploading...</span>
                            </div>
                          </div>
                        ) : photoPreview ? (
                          <div className="relative rounded-md overflow-hidden border border-border">
                            <img
                              src={photoPreview}
                              alt="Markup"
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
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentMarkupId(markup.id);
                                cameraInputRef.current?.click();
                              }}
                            >
                              <Camera className="h-3 w-3 mr-1" />
                              Photo
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentMarkupId(markup.id);
                                fileInputRef.current?.click();
                              }}
                            >
                              <ImageIcon className="h-3 w-3 mr-1" />
                              Gallery
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
