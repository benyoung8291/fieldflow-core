import { useState, useMemo, useRef, useEffect } from 'react';
import { BlobProvider } from '@react-pdf/renderer';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Loader2, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { FieldReportPDFDocument } from './FieldReportPDFDocument';
import { saveAs } from 'file-saver';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FieldReportPDFPreviewProps {
  report: any;
  companySettings: {
    name: string;
    logo_url?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

const A4_WIDTH_PT = 595;

export function FieldReportPDFPreview({ report, companySettings }: FieldReportPDFPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(0.7);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-zoom to fit container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        const padding = 32; // p-4 = 16px each side
        const optimalScale = (containerWidth - padding) / A4_WIDTH_PT;
        const clampedScale = Math.min(Math.max(optimalScale, 0.3), 1.5);
        setScale(clampedScale);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Memoize the PDF document to prevent unnecessary re-renders
  const pdfDocument = useMemo(() => {
    if (!report || !companySettings) return null;
    
    return (
      <FieldReportPDFDocument
        report={{
          ...report,
          photos: report.photos?.map((p: any) => ({
            ...p,
            photo_type: p.photo_type as 'before' | 'after' | 'problem' | 'other',
          })),
        }}
        companySettings={companySettings}
      />
    );
  }, [report, companySettings]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 2));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.3));
  };

  const handleDownload = () => {
    if (currentBlob && report) {
      const locationName = report.location?.name?.replace(/[^a-zA-Z0-9]/g, '-') || 'Location';
      const dateStr = report.service_date 
        ? new Date(report.service_date).toLocaleDateString('en-GB').replace(/\//g, '').slice(0, 8)
        : 'Report';
      saveAs(currentBlob, `${dateStr}-${locationName}.pdf`);
    }
  };

  if (!report || !companySettings) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Select a report to preview PDF</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Controls */}
      <div className="flex items-center justify-between p-2 border-b bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!currentBlob}
          className="h-8 gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <span className="text-xs text-muted-foreground">
          {numPages > 0 ? `${numPages} page${numPages > 1 ? 's' : ''}` : ''}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 0.3}
            className="h-8 w-8"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[45px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 2}
            className="h-8 w-8"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Preview - Stacked Scrollable Pages */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4">
        <BlobProvider document={pdfDocument!}>
          {({ blob, loading, error }) => {
            // Use effect-like pattern to store blob without causing render issues
            // This is handled via the BlobHandler component below
            
            if (loading) {
              return (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground">Generating preview...</p>
                  </div>
                </div>
              );
            }

            if (error) {
              return (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-destructive">Failed to generate PDF preview</p>
                </div>
              );
            }

            if (!blob) return null;

            // Store blob for download - using a ref check to avoid setting during render
            if (blob !== currentBlob) {
              // Schedule state update for next tick to avoid render-phase updates
              setTimeout(() => setCurrentBlob(blob), 0);
            }

            const blobUrl = URL.createObjectURL(blob);

            return (
              <div className="flex flex-col items-center gap-4">
                <Document
                  file={blobUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  }
                  error={
                    <div className="text-sm text-destructive p-4">
                      Failed to load PDF
                    </div>
                  }
                >
                  {/* Render all pages stacked vertically */}
                  {Array.from({ length: numPages }, (_, index) => (
                    <Page
                      key={`page_${index + 1}`}
                      pageNumber={index + 1}
                      scale={scale}
                      className="shadow-lg mb-4"
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  ))}
                </Document>
              </div>
            );
          }}
        </BlobProvider>
      </div>
    </div>
  );
}
