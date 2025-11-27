import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Square, ZoomIn, ZoomOut, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type MarkupType = "pin" | "zone";

export interface PinMarkup {
  id: string;
  type: "pin";
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  notes?: string;
}

export interface ZoneMarkup {
  id: string;
  type: "zone";
  bounds: {
    x: number; // percentage 0-100
    y: number; // percentage 0-100
    width: number; // percentage 0-100
    height: number; // percentage 0-100
  };
  notes?: string;
}

export type Markup = PinMarkup | ZoneMarkup;

interface FloorPlanViewerProps {
  pdfUrl: string;
  markups: Markup[];
  onMarkupsChange: (markups: Markup[]) => void;
  mode: MarkupType;
  onModeChange: (mode: MarkupType) => void;
}

export function FloorPlanViewer({
  pdfUrl,
  markups,
  onMarkupsChange,
  mode,
  onModeChange,
}: FloorPlanViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [touchStart, setTouchStart] = useState<{ distance: number } | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (mode === "pin") {
      const newMarkup: PinMarkup = {
        id: crypto.randomUUID(),
        type: "pin",
        x,
        y,
      };
      onMarkupsChange([...markups, newMarkup]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "zone") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setDrawStart({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || mode !== "zone") return;

    // Visual feedback while drawing (could add a preview element here)
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || mode !== "zone") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const endX = ((e.clientX - rect.left) / rect.width) * 100;
    const endY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.min(drawStart.x, endX);
    const y = Math.min(drawStart.y, endY);
    const width = Math.abs(endX - drawStart.x);
    const height = Math.abs(endY - drawStart.y);

    // Only create zone if it has meaningful size
    if (width > 1 && height > 1) {
      const newMarkup: ZoneMarkup = {
        id: crypto.randomUUID(),
        type: "zone",
        bounds: { x, y, width, height },
      };
      onMarkupsChange([...markups, newMarkup]);
    }

    setIsDrawing(false);
    setDrawStart(null);
  };

  const deleteMarkup = (id: string) => {
    onMarkupsChange(markups.filter((m) => m.id !== id));
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));

  // Touch handlers for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchStart({ distance });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStart) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleChange = distance / touchStart.distance;
      setScale((prev) => Math.min(Math.max(prev * scaleChange, 0.5), 3));
      setTouchStart({ distance });
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Apple-inspired Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 border-b border-border/40 bg-muted/30 rounded-t-2xl">
        {/* Mode Selection */}
        <div className="flex gap-2 flex-1">
          <Button
            variant={mode === "pin" ? "default" : "outline"}
            size="sm"
            onClick={() => onModeChange("pin")}
            className={cn(
              "flex-1 sm:flex-none rounded-xl transition-all",
              mode === "pin" && "shadow-sm"
            )}
          >
            <MapPin className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Pin</span>
          </Button>
          <Button
            variant={mode === "zone" ? "default" : "outline"}
            size="sm"
            onClick={() => onModeChange("zone")}
            className={cn(
              "flex-1 sm:flex-none rounded-xl transition-all",
              mode === "zone" && "shadow-sm"
            )}
          >
            <Square className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Area</span>
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="flex gap-2 items-center justify-center">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={zoomOut}
            className="rounded-xl h-9 w-9"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="rounded-lg px-3 py-1.5 font-semibold min-w-[4rem] text-center">
            {Math.round(scale * 100)}%
          </Badge>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={zoomIn}
            className="rounded-xl h-9 w-9"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Page Navigation */}
        {numPages > 0 && (
          <div className="flex items-center gap-2 justify-center sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-xl"
            >
              Previous
            </Button>
            <span className="text-sm font-medium px-2 whitespace-nowrap">
              {currentPage} of {numPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage === numPages}
              className="rounded-xl"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* PDF Viewer with Markups - refined container */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-muted/30 rounded-2xl touch-pan-x touch-pan-y"
        onClick={handleContainerClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          cursor: mode === "pin" ? "crosshair" : mode === "zone" ? "crosshair" : "default",
          boxShadow: 'inset 0 0 0 1px hsl(var(--border) / 0.4)'
        }}
      >
        <div className="relative inline-block" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            className="pdf-document"
          >
            <Page
              pageNumber={currentPage}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              width={containerDimensions.width || 800}
            />
          </Document>

          {/* Render Markups */}
          <div className="absolute inset-0 pointer-events-none">
            {markups.map((markup) => {
              if (markup.type === "pin") {
                return (
                  <div
                    key={markup.id}
                    className="absolute pointer-events-auto"
                    style={{
                      left: `${markup.x}%`,
                      top: `${markup.y}%`,
                      transform: "translate(-50%, -100%)",
                    }}
                  >
                    <div className="relative">
                      <MapPin className="h-8 w-8 text-red-500 fill-red-500/50 drop-shadow-lg" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                        onClick={() => deleteMarkup(markup.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={markup.id}
                    className="absolute border-2 border-yellow-500 bg-yellow-500/20 pointer-events-auto"
                    style={{
                      left: `${markup.bounds.x}%`,
                      top: `${markup.bounds.y}%`,
                      width: `${markup.bounds.width}%`,
                      height: `${markup.bounds.height}%`,
                    }}
                  >
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                      onClick={() => deleteMarkup(markup.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
