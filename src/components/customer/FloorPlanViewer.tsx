import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Square, ZoomIn, ZoomOut, Trash2, Undo, Redo, Move } from "lucide-react";
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
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [touchStart, setTouchStart] = useState<{ distance: number } | null>(null);
  const [selectedMarkup, setSelectedMarkup] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [history, setHistory] = useState<Markup[][]>([markups]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Update history when markups change
  const updateHistory = useCallback((newMarkups: Markup[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newMarkups);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onMarkupsChange(newMarkups);
  }, [history, historyIndex, onMarkupsChange]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onMarkupsChange(history[newIndex]);
      toast.success("Undone");
    }
  }, [historyIndex, history, onMarkupsChange]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onMarkupsChange(history[newIndex]);
      toast.success("Redone");
    }
  }, [historyIndex, history, onMarkupsChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedMarkup && !editingNote) {
          e.preventDefault();
          deleteMarkup(selectedMarkup);
        }
      } else if (e.key === 'Escape') {
        setSelectedMarkup(null);
        setEditingNote(null);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onModeChange('pin');
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        onModeChange('zone');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMarkup, editingNote, undo, redo, onModeChange]);

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
    const scaledRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width * scale,
      height: rect.height * scale,
    };
    
    const x = ((e.clientX - scaledRect.left) / scaledRect.width) * 100;
    const y = ((e.clientY - scaledRect.top) / scaledRect.height) * 100;

    if (mode === "pin") {
      const newMarkup: PinMarkup = {
        id: crypto.randomUUID(),
        type: "pin",
        x,
        y,
      };
      const newMarkups = [...markups, newMarkup];
      updateHistory(newMarkups);
      setSelectedMarkup(newMarkup.id);
      toast.success("Pin added - Click to edit note");
    } else {
      setSelectedMarkup(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "zone") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scaledRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width * scale,
      height: rect.height * scale,
    };
    
    const x = ((e.clientX - scaledRect.left) / scaledRect.width) * 100;
    const y = ((e.clientY - scaledRect.top) / scaledRect.height) * 100;

    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || mode !== "zone") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scaledRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width * scale,
      height: rect.height * scale,
    };
    
    const x = ((e.clientX - scaledRect.left) / scaledRect.width) * 100;
    const y = ((e.clientY - scaledRect.top) / scaledRect.height) * 100;

    setDrawCurrent({ x, y });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || mode !== "zone") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scaledRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width * scale,
      height: rect.height * scale,
    };
    
    const endX = ((e.clientX - scaledRect.left) / scaledRect.width) * 100;
    const endY = ((e.clientY - scaledRect.top) / scaledRect.height) * 100;

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
      setSelectedMarkup(newMarkup.id);
      toast.success("Area added - Click to edit note");
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const deleteMarkup = (id: string) => {
    const newMarkups = markups.filter((m) => m.id !== id);
    updateHistory(newMarkups);
    setSelectedMarkup(null);
    toast.success("Markup deleted");
  };

  const updateMarkupNote = (id: string, notes: string) => {
    const newMarkups = markups.map((m) => 
      m.id === id ? { ...m, notes } : m
    );
    updateHistory(newMarkups);
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
              "flex-1 sm:flex-none rounded-xl transition-all hover:scale-105",
              mode === "pin" && "shadow-md"
            )}
            title="Pin tool (P)"
          >
            <MapPin className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Pin</span>
            <kbd className="hidden lg:inline ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">P</kbd>
          </Button>
          <Button
            variant={mode === "zone" ? "default" : "outline"}
            size="sm"
            onClick={() => onModeChange("zone")}
            className={cn(
              "flex-1 sm:flex-none rounded-xl transition-all hover:scale-105",
              mode === "zone" && "shadow-md"
            )}
            title="Area tool (A)"
          >
            <Square className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Area</span>
            <kbd className="hidden lg:inline ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">A</kbd>
          </Button>
        </div>

        {/* Undo/Redo */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={undo}
            disabled={historyIndex === 0}
            className="rounded-xl h-9 w-9 hover:scale-105 transition-all"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className="rounded-xl h-9 w-9 hover:scale-105 transition-all"
            title="Redo (Ctrl+Y)"
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
            className="rounded-xl h-9 w-9 hover:scale-105 transition-all"
            title="Zoom out"
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
            className="rounded-xl h-9 w-9 hover:scale-105 transition-all"
            title="Zoom in"
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

      {/* PDF Viewer with Markups */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-gradient-to-br from-muted/20 to-muted/40 rounded-2xl touch-pan-x touch-pan-y"
        onClick={handleContainerClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          cursor: mode === "pin" ? "copy" : mode === "zone" ? "crosshair" : "default",
          boxShadow: 'inset 0 0 0 1px hsl(var(--border) / 0.3)'
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

          {/* Render Markups with enhanced interactivity */}
          <div className="absolute inset-0 pointer-events-none">
            {markups.map((markup) => {
              const isSelected = selectedMarkup === markup.id;
              const isEditing = editingNote === markup.id;
              
              if (markup.type === "pin") {
                return (
                  <div
                    key={markup.id}
                    className="absolute pointer-events-auto group"
                    style={{
                      left: `${markup.x}%`,
                      top: `${markup.y}%`,
                      transform: "translate(-50%, -100%)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMarkup(markup.id);
                    }}
                  >
                    <div className="relative">
                      <MapPin 
                        className={cn(
                          "h-10 w-10 transition-all duration-200 cursor-pointer",
                          isSelected 
                            ? "text-primary fill-primary/60 drop-shadow-[0_0_8px_rgba(var(--primary),0.5)] scale-110" 
                            : "text-destructive fill-destructive/50 drop-shadow-lg hover:scale-110"
                        )}
                      />
                      
                      {/* Controls - show on hover or selection */}
                      <div className={cn(
                        "absolute -top-3 -right-3 flex gap-1 transition-opacity",
                        isSelected || "opacity-0 group-hover:opacity-100"
                      )}>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-6 w-6 rounded-full shadow-lg hover:scale-110 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMarkup(markup.id);
                          }}
                          title="Delete (Del)"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Note display/edit */}
                      {(isSelected || markup.notes) && (
                        <div 
                          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 min-w-[200px] max-w-[300px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isEditing ? (
                            <Input
                              autoFocus
                              value={markup.notes || ""}
                              onChange={(e) => updateMarkupNote(markup.id, e.target.value)}
                              onBlur={() => setEditingNote(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setEditingNote(null);
                                if (e.key === 'Escape') setEditingNote(null);
                              }}
                              placeholder="Add note..."
                              className="text-sm shadow-lg"
                            />
                          ) : (
                            <div
                              onClick={() => setEditingNote(markup.id)}
                              className={cn(
                                "px-3 py-2 rounded-lg shadow-lg cursor-text transition-all",
                                "bg-background/95 backdrop-blur border border-border",
                                "hover:bg-accent hover:border-accent-foreground/20",
                                !markup.notes && "text-muted-foreground italic"
                              )}
                            >
                              {markup.notes || "Click to add note..."}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={markup.id}
                    className={cn(
                      "absolute border-2 transition-all duration-200 cursor-pointer pointer-events-auto group",
                      isSelected 
                        ? "border-primary bg-primary/20 shadow-[0_0_12px_rgba(var(--primary),0.4)]" 
                        : "border-yellow-500 bg-yellow-500/20 hover:bg-yellow-500/30 hover:border-yellow-400"
                    )}
                    style={{
                      left: `${markup.bounds.x}%`,
                      top: `${markup.bounds.y}%`,
                      width: `${markup.bounds.width}%`,
                      height: `${markup.bounds.height}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMarkup(markup.id);
                    }}
                  >
                    {/* Controls */}
                    <div className={cn(
                      "absolute -top-3 -right-3 flex gap-1 transition-opacity",
                      isSelected || "opacity-0 group-hover:opacity-100"
                    )}>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-6 w-6 rounded-full shadow-lg hover:scale-110 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMarkup(markup.id);
                        }}
                        title="Delete (Del)"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Note display/edit */}
                    {(isSelected || markup.notes) && (
                      <div 
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 min-w-[200px] max-w-[300px] z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEditing ? (
                          <Input
                            autoFocus
                            value={markup.notes || ""}
                            onChange={(e) => updateMarkupNote(markup.id, e.target.value)}
                            onBlur={() => setEditingNote(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setEditingNote(null);
                              if (e.key === 'Escape') setEditingNote(null);
                            }}
                            placeholder="Add note..."
                            className="text-sm shadow-lg"
                          />
                        ) : (
                          <div
                            onClick={() => setEditingNote(markup.id)}
                            className={cn(
                              "px-3 py-2 rounded-lg shadow-lg cursor-text transition-all",
                              "bg-background/95 backdrop-blur border border-border",
                              "hover:bg-accent hover:border-accent-foreground/20",
                              !markup.notes && "text-muted-foreground italic"
                            )}
                          >
                            {markup.notes || "Click to add note..."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            })}

            {/* Drawing preview for zones */}
            {isDrawing && drawStart && drawCurrent && mode === "zone" && (
              <div
                className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none animate-pulse"
                style={{
                  left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                  top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                  width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                  height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary">
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
