import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MapPin, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TicketFloorPlansProps {
  ticketId: string;
}

export function TicketFloorPlans({ ticketId }: TicketFloorPlansProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Fetch ticket markups and floor plans
  const { data: markupsData, isLoading } = useQuery({
    queryKey: ["ticket-markups", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_markups")
        .select(`
          *,
          floor_plan:floor_plans(
            id,
            name,
            file_url,
            image_url,
            customer_location_id
          )
        `)
        .eq("ticket_id", ticketId);

      if (error) throw error;
      return data;
    },
  });

  // Reset zoom and position when image loads
  useEffect(() => {
    if (imageLoaded && containerRef.current && imageRef.current) {
      fitToContainer();
    }
  }, [imageLoaded]);

  const fitToContainer = () => {
    if (!containerRef.current || !imageRef.current) return;
    
    const container = containerRef.current;
    const image = imageRef.current;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;
    
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const newScale = Math.min(scaleX, scaleY, 1); // Don't scale up, max 100%
    
    setScale(newScale);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleReset = () => {
    fitToContainer();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    setScale(prev => Math.min(Math.max(prev + delta, 0.1), 3));
  };

  if (isLoading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </Card>
    );
  }

  if (!markupsData || markupsData.length === 0) {
    return null; // Don't show anything if no floor plans
  }

  // Group markups by floor plan
  const floorPlanGroups = markupsData.reduce((acc, markup) => {
    const floorPlanId = markup.floor_plan?.id;
    if (!floorPlanId) return acc;
    
    if (!acc[floorPlanId]) {
      acc[floorPlanId] = {
        floorPlan: markup.floor_plan,
        markups: [],
      };
    }
    acc[floorPlanId].markups.push(markup);
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="space-y-4">
      {Object.values(floorPlanGroups).map((group: any) => {
        const imageUrl = group.floorPlan.image_url || group.floorPlan.file_url;
        
        return (
          <Card key={group.floorPlan.id} className="overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">{group.floorPlan.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {group.markups.length} markup{group.markups.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    className="h-8 w-8 p-0"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    className="h-8 w-8 p-0"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 w-8 p-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div 
              ref={containerRef}
              className="relative w-full bg-muted/50 overflow-hidden"
              style={{ height: "500px" }}
              onWheel={handleWheel}
            >
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  isDragging && "cursor-grabbing"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: "center center",
                    cursor: isDragging ? "grabbing" : "grab",
                  }}
                  className="relative"
                >
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={group.floorPlan.name}
                    className="max-w-none"
                    onLoad={() => setImageLoaded(true)}
                    draggable={false}
                  />
                  
                  {/* Render markup pins */}
                  {group.markups.map((markup: any) => (
                    <div
                      key={markup.id}
                      className="absolute"
                      style={{
                        left: `${markup.pin_x}%`,
                        top: `${markup.pin_y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-destructive border-2 border-white shadow-lg flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-white fill-white" />
                        </div>
                        {markup.markup_data?.notes && (
                          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-popover border rounded-lg p-2 shadow-lg whitespace-nowrap z-10 min-w-max max-w-xs">
                            <p className="text-xs text-foreground">{markup.markup_data.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
