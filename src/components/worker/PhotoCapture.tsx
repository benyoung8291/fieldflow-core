import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Camera, X, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoCaptureProps {
  onSave: (file: File, category: string, notes: string) => Promise<void>;
  onClose: () => void;
}

export default function PhotoCapture({ onSave, onClose }: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState('general');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await onSave(selectedFile, category, notes);
      toast.success('Photo uploaded successfully');
      onClose();
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Add Photo</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          {!preview ? (
            <div className="space-y-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32"
                variant="outline"
              >
                <div className="flex flex-col items-center gap-2">
                  <Camera className="h-8 w-8" />
                  <span>Take Photo</span>
                </div>
              </Button>
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute('capture');
                    fileInputRef.current.click();
                  }
                }}
                className="w-full h-32"
                variant="outline"
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8" />
                  <span>Choose from Gallery</span>
                </div>
              </Button>
            </div>
          ) : (
            <>
              <div className="relative rounded-lg overflow-hidden">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-64 object-cover"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="before">Before</SelectItem>
                    <SelectItem value="after">After</SelectItem>
                    <SelectItem value="issue">Issue/Problem</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="materials">Materials</SelectItem>
                    <SelectItem value="site">Site Conditions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this photo..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? 'Uploading...' : 'Save Photo'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
