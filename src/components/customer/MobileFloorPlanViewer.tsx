import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { MapPin, Square, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { MobileFloorPlanToolbar } from "./mobile/MobileFloorPlanToolbar";
import { MobileMarkupSheet } from "./mobile/MobileMarkupSheet";
import { throttle } from "@/utils/performance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type MarkupType = "pin" | "zone";

export interface PinMarkup {
  id: string;
  type: "pin";
  x: number;
  y: number;
  notes?: string;
}

export interface ZoneMarkup {
  id: string;
  type: "zone";
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  notes?: string;
}

export type Markup = PinMarkup | ZoneMarkup;

interface MobileFloorPlanViewerProps {
  pdfUrl: string;
  imageUrl?: string;
  markups: Markup[];
  onMarkupsChange: (markups: Markup[]) => void;
  readOnly?: boolean;
}

export function MobileFloorPlanViewer({
  pdfUrl,
  imageUrl,
  markups,
  onMarkupsChange,
  readOnly = false,
}: MobileFloorPlanViewerProps) {
  const displayUrl = imageUrl || pdfUrl;
  const isImage = imageUrl || !pdfUrl.toLowerCase().endsWith('.pdf');
  
  console.log("MobileFloorPlanViewer: Received markups:", markups);
  console.log("MobileFloorPlanViewer: PDF URL:", pdfUrl);
  console.log("MobileFloorPlanViewer: Image URL:", imageUrl);
  console.log("MobileFloorPlanViewer: Read-only mode:", readOnly);
  
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [mode, setMode] = useState<MarkupType | "pan">("pan");
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);
  const [history, setHistory] = useState<Markup[][]>([markups]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [markupSheetOpen, setMarkupSheetOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  
  // Pan state
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  
  // Pinch zoom state
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState<number>(1);
  const [pinchCenter, setPinchCenter] = useState<{ x: number; y: number } | null>(null);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedMarkupId, setDraggedMarkupId] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const updateHistory = (newMarkups: Markup[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newMarkups);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onMarkupsChange(newMarkups);
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

  const getTouchPosition = (touch: React.Touch): { x: number; y: number } => {
    if (!contentRef.current) return { x: 0, y: 0 };
    
    // Get the bounding rect of the transformed content
    const rect = contentRef.current.getBoundingClientRect();
    
    // Calculate position relative to the content
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    
    return { x, y };
  };

  const calculatePinchDistance = (touches: React.TouchList): number => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const calculatePinchCenter = (touches: React.TouchList): { x: number; y: number } => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleMarkupTouchStart = (e: React.TouchEvent, markupId: string) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const pos = getTouchPosition(touch);
    
    setDragStart(pos);
    setSelectedMarkupId(markupId);
    
    // Start long-press timer
    const timer = setTimeout(() => {
      setIsDragging(true);
      setDraggedMarkupId(markupId);
      toast.success("Hold to drag");
    }, 1000);
    
    setLongPressTimer(timer);
  };

  const handleMarkupTouchMove = useCallback(
    throttle((e: React.TouchEvent, markupId: string) => {
      if (!isDragging || draggedMarkupId !== markupId || !dragStart) return;
      
      e.stopPropagation();
      const touch = e.touches[0];
      const pos = getTouchPosition(touch);
      
      const markup = markups.find(m => m.id === markupId);
      if (!markup) return;
      
      requestAnimationFrame(() => {
        const newMarkups = markups.map((m) => {
          if (m.id === markupId) {
            if (m.type === "pin") {
              return { ...m, x: pos.x, y: pos.y };
            } else {
              const deltaX = pos.x - dragStart.x;
              const deltaY = pos.y - dragStart.y;
              return {
                ...m,
                bounds: {
                  x: m.bounds.x + deltaX,
                  y: m.bounds.y + deltaY,
                  width: m.bounds.width,
                  height: m.bounds.height,
                },
              };
            }
          }
          return m;
        });
        onMarkupsChange(newMarkups);
      });
      
      setDragStart(pos);
    }, 16),
    [isDragging, draggedMarkupId, dragStart, markups, onMarkupsChange]
  );

  const handleMarkupTouchEnd = (e: React.TouchEvent, markupId: string) => {
    e.stopPropagation();
    
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    if (isDragging) {
      updateHistory(markups);
      toast.success("Markup moved");
    }
    
    setIsDragging(false);
    setDraggedMarkupId(null);
    setDragStart(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Pinch to zoom (2 fingers)
    if (e.touches.length === 2) {
      setIsPanning(false);
      setIsDrawing(false);
      setInitialPinchDistance(calculatePinchDistance(e.touches));
      setInitialScale(scale);
      setPinchCenter(calculatePinchCenter(e.touches));
      return;
    }

    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    
    // In read-only mode, only allow panning
    if (readOnly) {
      setIsPanning(true);
      setPanStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
      return;
    }
    
    if (mode === "pin") {
      const pos = getTouchPosition(touch);
      const newMarkup: PinMarkup = {
        id: crypto.randomUUID(),
        type: "pin",
        x: pos.x,
        y: pos.y,
      };
      const newMarkups = [...markups, newMarkup];
      updateHistory(newMarkups);
    } else if (mode === "zone") {
      const pos = getTouchPosition(touch);
      setIsDrawing(true);
      setDrawStart(pos);
      setDrawCurrent(pos);
    } else {
      // Default: pan mode (always allow panning with single finger)
      setIsPanning(true);
      setPanStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = useCallback(
    throttle((e: React.TouchEvent<HTMLDivElement>) => {
      // Pinch to zoom (2 fingers)
      if (e.touches.length === 2 && initialPinchDistance && pinchCenter) {
        e.preventDefault();
        const currentDistance = calculatePinchDistance(e.touches);
        const currentCenter = calculatePinchCenter(e.touches);
        
        // Calculate new scale
        const scaleChange = currentDistance / initialPinchDistance;
        const newScale = Math.max(0.5, Math.min(3, initialScale * scaleChange));
        
        // Adjust offset to zoom towards pinch center
        const scaleDiff = newScale - scale;
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const centerX = pinchCenter.x - rect.left;
          const centerY = pinchCenter.y - rect.top;
          
          requestAnimationFrame(() => {
            setScale(newScale);
            setOffset(prev => ({
              x: prev.x - (centerX - rect.width / 2) * scaleDiff / scale,
              y: prev.y - (centerY - rect.height / 2) * scaleDiff / scale,
            }));
          });
        }
        return;
      }

      if (e.touches.length !== 1) return;
      
      const touch = e.touches[0];

      // Panning (works for any mode with single finger)
      if (isPanning && panStart) {
        e.preventDefault();
        requestAnimationFrame(() => {
          setOffset({
            x: touch.clientX - panStart.x,
            y: touch.clientY - panStart.y,
          });
        });
      } else if (mode === "zone" && isDrawing && drawStart) {
        const pos = getTouchPosition(touch);
        requestAnimationFrame(() => {
          setDrawCurrent(pos);
        });
      }
    }, 16),
    [mode, isPanning, panStart, isDrawing, drawStart, scale, initialPinchDistance, pinchCenter, initialScale]
  );

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    // Reset pinch state when fingers are lifted
    if (e.touches.length < 2) {
      setInitialPinchDistance(null);
      setPinchCenter(null);
    }

    // Always reset panning when touch ends
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
    }
    
    if (mode === "zone" && isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.abs(drawCurrent.x - drawStart.x);
      const height = Math.abs(drawCurrent.y - drawStart.y);

      if (width > 1 && height > 1) {
        const newMarkup: ZoneMarkup = {
          id: crypto.randomUUID(),
          type: "zone",
          bounds: { x, y, width, height },
        };
        const newMarkups = [...markups, newMarkup];
        updateHistory(newMarkups);
      }

      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
    }
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
    // Reset pan when zooming out to fit
    if (scale <= 0.75) {
      setOffset({ x: 0, y: 0 });
    }
  };

  const updateMarkupNote = (id: string, notes: string) => {
    const newMarkups = markups.map((m) => (m.id === id ? { ...m, notes } : m));
    onMarkupsChange(newMarkups);
  };

  const deleteMarkup = (id: string) => {
    const newMarkups = markups.filter((m) => m.id !== id);
    updateHistory(newMarkups);
    toast.success("Markup deleted");
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-muted/20">
      {!readOnly && (
        <MobileFloorPlanToolbar
          mode={mode}
          onModeChange={setMode}
          scale={scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          markupsCount={markups.length}
          onOpenMarkups={() => setMarkupSheetOpen(true)}
          readOnly={readOnly}
        />
      )}

      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: readOnly ? "grab" : mode === "pin" ? "crosshair" : mode === "zone" ? "crosshair" : isPanning ? "grabbing" : "grab",
        }}
      >
        <div
          ref={contentRef}
          className="relative"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
            willChange: "transform",
          }}
        >
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
              style={{
                width: containerDimensions.width || "100%",
                height: "auto",
                display: "block",
                pointerEvents: "none",
              }}
            />
          ) : (
            <Document
              file={displayUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              className="flex justify-center"
            >
              <Page
                pageNumber={currentPage}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={containerDimensions.width || window.innerWidth}
              />
            </Document>
          )}

          {/* Markups overlay */}
          <div className="absolute inset-0">
            {markups.map((markup, index) => {
              if (markup.type === "pin") {
                return (
                  <div
                    key={markup.id}
                    className={cn(
                      "absolute transition-all touch-none",
                      selectedMarkupId === markup.id && "scale-125",
                      isDragging && draggedMarkupId === markup.id && "z-50"
                    )}
                    style={{
                      left: `${markup.x}%`,
                      top: `${markup.y}%`,
                      transform: "translate(-50%, -100%)",
                      pointerEvents: "auto",
                    }}
                    onTouchStart={(e) => handleMarkupTouchStart(e, markup.id)}
                    onTouchMove={(e) => handleMarkupTouchMove(e, markup.id)}
                    onTouchEnd={(e) => handleMarkupTouchEnd(e, markup.id)}
                  >
                    <div className="relative flex flex-col items-center">
                      <MapPin 
                        className={cn(
                          "h-10 w-10 text-destructive fill-destructive/60 drop-shadow-2xl transition-all",
                          selectedMarkupId === markup.id && "animate-pulse"
                        )}
                      />
                      <div className="absolute -bottom-7 bg-background/95 backdrop-blur px-3 py-1 rounded-full border-2 border-border shadow-xl">
                        <span className="text-sm font-bold">#{index + 1}</span>
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={markup.id}
                    className={cn(
                      "absolute border-4 border-orange-500 bg-orange-500/30 transition-all shadow-lg touch-none",
                      selectedMarkupId === markup.id && "border-orange-600 bg-orange-500/40 animate-pulse",
                      isDragging && draggedMarkupId === markup.id && "z-50"
                    )}
                    style={{
                      left: `${markup.bounds.x}%`,
                      top: `${markup.bounds.y}%`,
                      width: `${markup.bounds.width}%`,
                      height: `${markup.bounds.height}%`,
                      pointerEvents: "auto",
                    }}
                    onTouchStart={(e) => handleMarkupTouchStart(e, markup.id)}
                    onTouchMove={(e) => handleMarkupTouchMove(e, markup.id)}
                    onTouchEnd={(e) => handleMarkupTouchEnd(e, markup.id)}
                  >
                    <div className="absolute top-2 left-2 bg-background/95 backdrop-blur px-3 py-1 rounded-full border-2 border-border shadow-xl">
                      <span className="text-sm font-bold">#{index + 1}</span>
                    </div>
                  </div>
                );
              }
            })}

            {/* Drawing preview */}
            {isDrawing && drawStart && drawCurrent && mode === "zone" && (
              <div
                className="absolute border-4 border-dashed border-orange-500 bg-orange-500/20 pointer-events-none animate-pulse shadow-lg"
                style={{
                  left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                  top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                  width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                  height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {!readOnly && (
        <MobileMarkupSheet
          markups={markups}
          selectedMarkupId={selectedMarkupId}
          onMarkupSelect={setSelectedMarkupId}
          onMarkupUpdate={updateMarkupNote}
          onMarkupDelete={deleteMarkup}
          open={markupSheetOpen}
          onOpenChange={setMarkupSheetOpen}
        />
      )}
    </div>
  );
}
