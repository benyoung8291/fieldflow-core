import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LocationProgress {
  id: string;
  name: string;
  address: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  latitude?: number;
  longitude?: number;
  error?: string;
  needsConfirmation?: boolean;
}

interface GeocodeProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: LocationProgress[];
  currentIndex: number;
  onConfirmLocation: (locationId: string) => void;
  onSkipLocation: (locationId: string) => void;
  isComplete: boolean;
}

export default function GeocodeProgressDialog({
  open,
  onOpenChange,
  locations,
  currentIndex,
  onConfirmLocation,
  onSkipLocation,
  isComplete
}: GeocodeProgressDialogProps) {
  const progress = locations.length > 0 ? ((currentIndex + 1) / locations.length) * 100 : 0;
  const successCount = locations.filter(l => l.status === 'success').length;
  const errorCount = locations.filter(l => l.status === 'error').length;
  const skippedCount = locations.filter(l => l.status === 'skipped').length;
  
  const currentLocation = locations.find(l => l.needsConfirmation);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Geocoding Locations
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col min-h-0">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>{currentIndex + 1} of {locations.length} locations processed</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
            
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-success flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                {successCount} successful
              </span>
              {errorCount > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {errorCount} failed
                </span>
              )}
              {skippedCount > 0 && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {skippedCount} skipped
                </span>
              )}
            </div>
          </div>

          {currentLocation && (
            <div className="border border-warning/50 bg-warning/10 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">Confirm Location</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Unable to geocode this location automatically. Please confirm if you want to continue trying or skip it.
                  </p>
                </div>
              </div>
              
              <div className="bg-background rounded p-3 mb-3 space-y-2 text-sm">
                <p className="font-medium">{currentLocation.name}</p>
                <p className="text-muted-foreground">{currentLocation.address}</p>
              </div>
              
              {currentLocation.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3 mb-3">
                  <p className="text-destructive text-sm font-medium">Error Details:</p>
                  <p className="text-destructive text-xs mt-1">{currentLocation.error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => onConfirmLocation(currentLocation.id)}
                  variant="default"
                  size="sm"
                >
                  Retry
                </Button>
                <Button
                  onClick={() => onSkipLocation(currentLocation.id)}
                  variant="outline"
                  size="sm"
                >
                  Skip
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 border rounded-lg min-h-0">
            <div className="p-4 space-y-2">
              {locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-start justify-between gap-3 p-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{location.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{location.address}</p>
                    {location.latitude && location.longitude && (
                      <p className="text-xs text-success mt-1">
                        Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </p>
                    )}
                    {location.error && (
                      <p className="text-xs text-destructive mt-1">{location.error}</p>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0">
                    {location.status === 'pending' && (
                      <div className="h-5 w-5 rounded-full bg-muted" />
                    )}
                    {location.status === 'processing' && (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    )}
                    {location.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-success" />
                    )}
                    {location.status === 'error' && (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    {location.status === 'skipped' && (
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {isComplete && (
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
