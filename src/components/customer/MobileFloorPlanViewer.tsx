import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { MapPin, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { MobileFloorPlanToolbar } from "./mobile/MobileFloorPlanToolbar";
import { MobileMarkupSheet } from "./mobile/MobileMarkupSheet";
import { throttle } from "@/utils/performance";

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
}

export function MobileFloorPlanViewer({
  pdfUrl,
  imageUrl,
  markups,
  onMarkupsChange,
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
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  
  // Pan state
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

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

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    if (mode === "pan") {
      setIsPanning(true);
      setPanStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    } else if (mode === "pin") {
      const x = ((touch.clientX - rect.left) / rect.width) * 100;
      const y = ((touch.clientY - rect.top) / rect.height) * 100;
      
      const newMarkup: PinMarkup = {
        id: crypto.randomUUID(),
        type: "pin",
        x,
        y,
      };
      const newMarkups = [...markups, newMarkup];
      updateHistory(newMarkups);
      toast.success("Pin added");
    } else if (mode === "zone") {
      const x = ((touch.clientX - rect.left) / rect.width) * 100;
      const y = ((touch.clientY - rect.top) / rect.height) * 100;
      setIsDrawing(true);
      setDrawStart({ x, y });
      setDrawCurrent({ x, y });
    }
  };

  const handleTouchMove = useCallback(
    throttle((e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length !== 1) return;
      
      const touch = e.touches[0];
      const container = e.currentTarget;
      const rect = container.getBoundingClientRect();

      if (mode === "pan" && isPanning && panStart) {
        e.preventDefault();
        requestAnimationFrame(() => {
          setOffset({
            x: touch.clientX - panStart.x,
            y: touch.clientY - panStart.y,
          });
        });
      } else if (mode === "zone" && isDrawing && drawStart) {
        const x = ((touch.clientX - rect.left) / rect.width) * 100;
        const y = ((touch.clientY - rect.top) / rect.height) * 100;
        requestAnimationFrame(() => {
          setDrawCurrent({ x, y });
        });
      }
    }, 16),
    [mode, isPanning, panStart, isDrawing, drawStart]
  );

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (mode === "pan") {
      setIsPanning(false);
      setPanStart(null);
    } else if (mode === "zone" && isDrawing && drawStart && drawCurrent) {
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
        toast.success("Area added");
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
      <MobileFloorPlanToolbar
        mode={mode}
        onModeChange={setMode}
        scale={scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />

      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: mode === "pan" ? "grab" : mode === "pin" ? "crosshair" : "crosshair",
        }}
      >
        <div
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
          <div className="absolute inset-0 pointer-events-none">
            {markups.map((markup, index) => {
              if (markup.type === "pin") {
                return (
                  <div
                    key={markup.id}
                    className={cn(
                      "absolute pointer-events-none transition-all",
                      selectedMarkupId === markup.id && "scale-125"
                    )}
                    style={{
                      left: `${markup.x}%`,
                      top: `${markup.y}%`,
                      transform: "translate(-50%, -100%)",
                    }}
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
                      "absolute border-4 border-yellow-500 bg-yellow-500/20 pointer-events-none transition-all",
                      selectedMarkupId === markup.id && "border-yellow-600 bg-yellow-500/30 animate-pulse"
                    )}
                    style={{
                      left: `${markup.bounds.x}%`,
                      top: `${markup.bounds.y}%`,
                      width: `${markup.bounds.width}%`,
                      height: `${markup.bounds.height}%`,
                    }}
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
                className="absolute border-4 border-dashed border-primary bg-primary/20 pointer-events-none animate-pulse"
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

      <MobileMarkupSheet
        markups={markups}
        selectedMarkupId={selectedMarkupId}
        onMarkupSelect={setSelectedMarkupId}
        onMarkupUpdate={updateMarkupNote}
        onMarkupDelete={deleteMarkup}
      />
    </div>
  );
}
