import { useState, useRef, useEffect } from "react";
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
  const [pageWidth, setPageWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fileUrl = floorPlan.file_url || "";
  const isPDF = fileUrl.toLowerCase().endsWith('.pdf');
  const imageUrl = floorPlan.image_url || (!isPDF ? floorPlan.file_url : "");

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setPageWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const getMarkupStyle = (markup: Markup) => {
    return {
      position: "absolute" as const,
      left: `${markup.pin_x}%`,
      top: `${markup.pin_y}%`,
      transform: "translate(-50%, -100%)",
    };
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
          className="relative overflow-hidden bg-muted"
          style={{ height: "400px", touchAction: "none" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 0.1s",
              position: "relative",
              width: "100%",
              height: "100%",
            }}
          >
            {isPDF && fileUrl ? (
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                className="flex justify-center"
              >
                <Page
                  pageNumber={1}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            ) : (
              <img
                src={imageUrl}
                alt={floorPlan.name}
                className="w-full h-full object-contain"
                draggable={false}
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
                  style={getMarkupStyle(markup)}
                  onClick={() => onMarkupClick(markup)}
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
      </CardContent>
    </Card>
  );
}
