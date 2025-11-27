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
  
  // Track if multi-touch gesture occurred
  const [multiTouchActive, setMultiTouchActive] = useState(false);
  const [singleTouchStart, setSingleTouchStart] = useState<{ x: number; y: number } | null>(null);

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

  // Auto-zoom to fit markups in read-only mode
  useEffect(() => {
    if (!readOnly || markups.length === 0 || !containerDimensions.width || !contentRef.current) {
      return;
    }

    // Calculate bounding box of all markups
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    markups.forEach((markup) => {
      if (markup.type === "pin") {
        minX = Math.min(minX, markup.x);
        maxX = Math.max(maxX, markup.x);
        minY = Math.min(minY, markup.y);
        maxY = Math.max(maxY, markup.y);
      } else {
        minX = Math.min(minX, markup.bounds.x);
        maxX = Math.max(maxX, markup.bounds.x + markup.bounds.width);
        minY = Math.min(minY, markup.bounds.y);
        maxY = Math.max(maxY, markup.bounds.y + markup.bounds.height);
      }
    });

    // Add padding (20% on each side)
    const paddingPercent = 20;
    const widthRange = maxX - minX;
    const heightRange = maxY - minY;
    
    minX = Math.max(0, minX - paddingPercent);
    maxX = Math.min(100, maxX + paddingPercent);
    minY = Math.max(0, minY - paddingPercent);
    maxY = Math.min(100, maxY + paddingPercent);

    // Calculate the center point of all markups
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate scale needed to fit markups
    // We want the markups to fill about 70% of the viewport
    const markupWidthPercent = maxX - minX;
    const markupHeightPercent = maxY - minY;
    
    const scaleForWidth = markupWidthPercent > 0 ? (70 / markupWidthPercent) : 1;
    const scaleForHeight = markupHeightPercent > 0 ? (70 / markupHeightPercent) : 1;
    
    // Use the smaller scale to ensure everything fits
    const calculatedScale = Math.min(scaleForWidth, scaleForHeight, 3); // Cap at 3x
    const finalScale = Math.max(1.5, calculatedScale); // Minimum 1.5x zoom

    // Calculate offset to center the markups
    const contentWidth = containerDimensions.width;
    const contentHeight = containerDimensions.height;
    
    // Convert center percentage to pixels at the calculated scale
    const centerXPixels = (centerX / 100) * contentWidth * finalScale;
    const centerYPixels = (centerY / 100) * contentHeight * finalScale;
    
    // Calculate offset to center this point in the viewport
    const offsetX = (contentWidth / 2) - centerXPixels;
    const offsetY = (contentHeight / 2) - centerYPixels;

    console.log("Auto-zoom calculations:", {
      markups: markups.length,
      bounds: { minX, maxX, minY, maxY },
      center: { centerX, centerY },
      scale: finalScale,
      offset: { offsetX, offsetY }
    });

    setScale(finalScale);
    setOffset({ x: offsetX, y: offsetY });
  }, [readOnly, markups, containerDimensions.width, containerDimensions.height]);

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
      setMultiTouchActive(true);
      setIsPanning(false);
      setIsDrawing(false);
      setSingleTouchStart(null);
      setInitialPinchDistance(calculatePinchDistance(e.touches));
      setInitialScale(scale);
      setPinchCenter(calculatePinchCenter(e.touches));
      return;
    }

    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const pos = getTouchPosition(touch);
    
    // Reset multi-touch flag for new single-touch interaction
    setMultiTouchActive(false);
    
    // In read-only mode, only allow panning
    if (readOnly) {
      setIsPanning(true);
      setPanStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
      return;
    }
    
    if (mode === "pin") {
      // Store touch position but don't place pin yet - wait to see if second finger arrives
      setSingleTouchStart(pos);
    } else if (mode === "zone") {
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
    
    // Place pin only if it was a single-touch tap (no multi-touch gesture occurred)
    if (mode === "pin" && singleTouchStart && !multiTouchActive && !isPanning) {
      const newMarkup: PinMarkup = {
        id: crypto.randomUUID(),
        type: "pin",
        x: singleTouchStart.x,
        y: singleTouchStart.y,
      };
      const newMarkups = [...markups, newMarkup];
      updateHistory(newMarkups);
    }
    
    setSingleTouchStart(null);
    
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
    
    // Reset multi-touch flag when all touches are lifted
    if (e.touches.length === 0) {
      setMultiTouchActive(false);
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
                const pinScale = 1 / scale;
                const baseScale = selectedMarkupId === markup.id ? 1.25 : 1;
                return (
                  <div
                    key={markup.id}
                    className={cn(
                      "absolute transition-all touch-none",
                      isDragging && draggedMarkupId === markup.id && "z-50"
                    )}
                    style={{
                      left: `${markup.x}%`,
                      top: `${markup.y}%`,
                      transform: `translate(-50%, -100%) scale(${pinScale * baseScale})`,
                      transformOrigin: 'bottom center',
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
