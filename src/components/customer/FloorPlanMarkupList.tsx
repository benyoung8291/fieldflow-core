import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, MapPin, Square, Camera, Image as ImageIcon, X } from "lucide-react";
import { Markup } from "./FloorPlanViewer";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface FloorPlanMarkupListProps {
  markups: Markup[];
  onMarkupUpdate: (id: string, notes: string) => void;
  onMarkupPhotoUpdate: (id: string, photo: File | null) => void;
  onMarkupDelete: (id: string) => void;
  selectedMarkupId: string | null;
  onMarkupSelect: (id: string) => void;
}

export function FloorPlanMarkupList({
  markups,
  onMarkupUpdate,
  onMarkupPhotoUpdate,
  onMarkupDelete,
  selectedMarkupId,
  onMarkupSelect,
}: FloorPlanMarkupListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentMarkupId, setCurrentMarkupId] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, markupId: string) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error("Image must be less than 10MB");
        return;
      }
      onMarkupPhotoUpdate(markupId, file);
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
                    {photoPreview ? (
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
