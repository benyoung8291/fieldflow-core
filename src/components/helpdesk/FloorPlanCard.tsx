import { MapPin, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FloorPlanCardProps {
  floorPlan: {
    id: string;
    name: string;
    image_url?: string;
    file_url?: string;
  };
  markups: Array<{
    id: string;
    pin_x: number;
    pin_y: number;
    markup_data?: {
      notes?: string;
    };
  }>;
}

export function FloorPlanCard({ floorPlan, markups }: FloorPlanCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [numPages, setNumPages] = useState<number>(1);
  const [pageWidth, setPageWidth] = useState<number>(0);

  const fileUrl = floorPlan.file_url || "";
  const isPDF = fileUrl.toLowerCase().endsWith('.pdf');
  const imageUrl = floorPlan.image_url || (!isPDF ? floorPlan.file_url : "");

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
    
    if (imageWidth === 0 || imageHeight === 0) return;
    
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setImageLoaded(true);
  };

  const onPageLoadSuccess = (page: any) => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      setPageWidth(containerWidth);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">{floorPlan.name}</h3>
            <span className="text-xs text-muted-foreground">
              {markups.length} markup{markups.length !== 1 ? 's' : ''}
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
        className="relative w-full h-full min-h-[400px] bg-muted/50 overflow-hidden"
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
            {isPDF ? (
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                className="flex flex-col items-center"
              >
                <Page
                  pageNumber={1}
                  width={pageWidth || undefined}
                  onLoadSuccess={onPageLoadSuccess}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="relative"
                />
              </Document>
            ) : (
              <img
                ref={imageRef}
                src={imageUrl}
                alt={floorPlan.name}
                className="max-w-none block"
                onLoad={() => setImageLoaded(true)}
                draggable={false}
                style={{
                  width: "auto",
                  height: "auto",
                }}
              />
            )}
            
            {/* Render markup pins */}
            {imageLoaded && markups.map((markup) => (
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
}
