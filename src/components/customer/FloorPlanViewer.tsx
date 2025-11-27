import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Square, ZoomIn, ZoomOut, Undo, Redo } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  imageUrl?: string; // Optional pre-converted image URL for faster loading
  markups: Markup[];
  onMarkupsChange: (markups: Markup[]) => void;
  mode: MarkupType;
  onModeChange: (mode: MarkupType) => void;
}

export function FloorPlanViewer({
  pdfUrl,
  imageUrl,
  markups,
  onMarkupsChange,
  mode,
  onModeChange,
}: FloorPlanViewerProps) {
  // Prefer imageUrl over pdfUrl for better performance
  const displayUrl = imageUrl || pdfUrl;
  const isImage = imageUrl || !pdfUrl.toLowerCase().endsWith('.pdf');
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [touchStart, setTouchStart] = useState<{ distance: number } | null>(null);
  const [history, setHistory] = useState<Markup[][]>([markups]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Update history when markups change
  const updateHistory = (newMarkups: Markup[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newMarkups);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onMarkupsChange(newMarkups);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onMarkupsChange(history[newIndex]);
      toast.success("Undone");
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onMarkupsChange(history[newIndex]);
      toast.success("Redone");
    }
  };

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
    if (mode !== "pin") return;
    
    // Don't prevent clicks on child elements for pin mode
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    
    // Calculate position relative to the container
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newMarkup: PinMarkup = {
      id: crypto.randomUUID(),
      type: "pin",
      x,
      y,
    };
    const newMarkups = [...markups, newMarkup];
    updateHistory(newMarkups);
    toast.success("Pin added");
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "zone") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || mode !== "zone") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setDrawCurrent({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
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
      const newMarkups = [...markups, newMarkup];
      updateHistory(newMarkups);
      toast.success("Area added");
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
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
      {/* Improved Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 border border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-2xl shadow-sm">
        {/* Mode Selection with keyboard shortcuts */}
        <div className="flex gap-2 flex-1">
            <Button
            variant={mode === "pin" ? "default" : "outline"}
            size="sm"
            onClick={() => onModeChange("pin")}
            className={cn(
              "flex-1 sm:flex-none rounded-xl transition-all",
              mode === "pin" && "shadow-md"
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
              mode === "zone" && "shadow-md"
            )}
          >
            <Square className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Area</span>
          </Button>
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={undo}
            disabled={historyIndex === 0}
            className="rounded-xl h-9 w-9"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className="rounded-xl h-9 w-9"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="flex gap-2 items-center justify-center">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="rounded-xl h-9 w-9"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Badge variant="secondary" className="rounded-lg px-3 py-1.5 font-semibold min-w-[4rem] text-center tabular-nums">
            {Math.round(scale * 100)}%
          </Badge>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={zoomIn}
            disabled={scale >= 3}
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

      {/* Floor Plan Viewer with Markups */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-gradient-to-br from-muted/20 to-muted/40 rounded-2xl touch-none"
        onClick={handleContainerClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          cursor: mode === "pin" ? "crosshair" : mode === "zone" ? "crosshair" : "default",
          boxShadow: 'inset 0 0 0 1px hsl(var(--border) / 0.3)'
        }}
      >
        <div className="relative inline-block" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {isImage ? (
            <img
              src={displayUrl}
              alt="Floor plan"
              onLoad={() => {
                if (containerRef.current) {
                  setContainerDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                  });
                }
                setNumPages(1);
              }}
              onError={(error) => {
                console.error("Image load error:", error);
                toast.error("Failed to load floor plan");
              }}
              style={{ 
                width: containerDimensions.width || 800,
                height: 'auto',
                display: 'block'
              }}
            />
          ) : (
            <Document
              file={displayUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => {
                console.error("PDF load error:", error);
                toast.error("Failed to load floor plan");
              }}
              className="pdf-document"
            >
              <Page
                pageNumber={currentPage}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                width={containerDimensions.width || 800}
              />
            </Document>
          )}

          {/* Render Markups - simplified for list-based editing */}
          <div className="absolute inset-0 pointer-events-none">
            {markups.map((markup, index) => {
              if (markup.type === "pin") {
                const pinScale = 1 / scale;
                return (
                  <div
                    key={markup.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${markup.x}%`,
                      top: `${markup.y}%`,
                      transform: `translate(-50%, -100%) scale(${pinScale})`,
                      transformOrigin: 'bottom center',
                    }}
                  >
                    <div className="relative flex flex-col items-center">
                      <MapPin 
                        className="h-8 w-8 text-destructive fill-destructive/60 drop-shadow-lg"
                      />
                      <div className="absolute -bottom-6 bg-background/95 backdrop-blur px-2 py-0.5 rounded-full border border-border shadow-md">
                        <span className="text-xs font-semibold">#{index + 1}</span>
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={markup.id}
                    className="absolute border-4 border-orange-500 bg-orange-500/30 pointer-events-none shadow-lg"
                    style={{
                      left: `${markup.bounds.x}%`,
                      top: `${markup.bounds.y}%`,
                      width: `${markup.bounds.width}%`,
                      height: `${markup.bounds.height}%`,
                    }}
                  >
                    <div className="absolute top-1 left-1 bg-background/95 backdrop-blur px-2 py-0.5 rounded-full border border-border shadow-md">
                      <span className="text-xs font-semibold">#{index + 1}</span>
                    </div>
                  </div>
                );
              }
            })}

            {/* Drawing preview for zones */}
            {isDrawing && drawStart && drawCurrent && mode === "zone" && (
              <div
                className="absolute border-4 border-dashed border-orange-500 bg-orange-500/20 pointer-events-none animate-pulse shadow-lg"
                style={{
                  left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                  top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                  width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                  height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-orange-600">
                  Release to create
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
