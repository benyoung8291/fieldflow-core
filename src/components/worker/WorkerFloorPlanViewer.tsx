import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Markup {
  id: string;
  markup_data: any;
  notes?: string;
  photo_url?: string;
  status?: string;
  pin_x?: number;
  pin_y?: number;
}

interface WorkerFloorPlanViewerProps {
  floorPlan: any;
  markups: Markup[];
  onMarkupClick: (markup: Markup) => void;
  selectedMarkupId?: string;
}

export function WorkerFloorPlanViewer({
  floorPlan,
  markups,
  onMarkupClick,
  selectedMarkupId,
}: WorkerFloorPlanViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [numPages, setNumPages] = useState<number>(0);
  const [contentDimensions, setContentDimensions] = useState({ width: 0, height: 0 });
  const [touchStartDistance, setTouchStartDistance] = useState<number>(0);
  const [initialScale, setInitialScale] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const fileUrl = floorPlan.file_url || "";
  const isPDF = fileUrl.toLowerCase().endsWith('.pdf');
  const imageUrl = floorPlan.image_url || (!isPDF ? floorPlan.file_url : "");

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handlePageLoad = useCallback((page: any) => {
    const { width, height } = page;
    setContentDimensions({ width, height });
  }, []);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setContentDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  useEffect(() => {
    if (contentDimensions.width > 0 && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;
      const scaleX = containerWidth / contentDimensions.width;
      const scaleY = containerHeight / contentDimensions.height;
      const fitScale = Math.min(scaleX, scaleY, 1) * 0.9;
      setScale(fitScale);
    }
  }, [contentDimensions]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const handleReset = () => {
    if (contentDimensions.width > 0 && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;
      const scaleX = containerWidth / contentDimensions.width;
      const scaleY = containerHeight / contentDimensions.height;
      const fitScale = Math.min(scaleX, scaleY, 1) * 0.9;
      setScale(fitScale);
      setPosition({ x: 0, y: 0 });
    }
  };

  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      setTouchStartDistance(getDistance(e.touches));
      setInitialScale(scale);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const scaleChange = currentDistance / touchStartDistance;
      const newScale = Math.min(Math.max(initialScale * scaleChange, 0.5), 3);
      setScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchStartDistance(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setScale((s) => Math.min(Math.max(s + delta, 0.5), 3));
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "completed":
        return "bg-success";
      case "in_progress":
        return "bg-warning";
      default:
        return "bg-destructive";
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        {/* Controls */}
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium">Floor Plan</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Floor Plan with Markups */}
        <div
          ref={containerRef}
          className="relative overflow-hidden bg-muted cursor-move"
          style={{ height: "400px", touchAction: "none" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div
            className="flex items-center justify-center w-full h-full"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.2s ease-out",
            }}
          >
            <div ref={contentRef} className="relative" style={{ display: 'inline-block' }}>
              {isPDF && fileUrl ? (
                <Document
                  file={fileUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                >
                  <Page
                    pageNumber={1}
                    width={contentDimensions.width || 600}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onLoadSuccess={handlePageLoad}
                  />
                </Document>
              ) : (
                <img
                  src={imageUrl}
                  alt={floorPlan.name}
                  style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }}
                  draggable={false}
                  onLoad={handleImageLoad}
                />
              )}

              {/* Markup Pins */}
              {markups.map((markup, index) => {
                const isSelected = markup.id === selectedMarkupId;
                return (
                  <button
                    key={markup.id}
                    className={`absolute z-10 transition-all ${
                      isSelected ? "scale-125" : ""
                    }`}
                    style={{
                      left: `${markup.pin_x}%`,
                      top: `${markup.pin_y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkupClick(markup);
                    }}
                  >
                    <div className="relative">
                      <div
                        className={`w-8 h-8 rounded-full ${getStatusColor(
                          markup.status
                        )} flex items-center justify-center text-white font-bold text-sm shadow-lg border-2 border-white`}
                      >
                        {index + 1}
                      </div>
                      {isSelected && (
                        <div className="absolute inset-0 rounded-full animate-ping bg-primary opacity-75" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
