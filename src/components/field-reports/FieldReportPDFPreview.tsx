import { useState, useEffect, useMemo } from 'react';
import { BlobProvider } from '@react-pdf/renderer';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { FieldReportPDFDocument } from './FieldReportPDFDocument';
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

export function FieldReportPDFPreview({ report, companySettings }: FieldReportPDFPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.8);
  const [containerWidth, setContainerWidth] = useState<number>(400);

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
    setCurrentPage(1);
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 2));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.4));
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2 min-w-[80px] text-center">
            {numPages > 0 ? `${currentPage} / ${numPages}` : '-'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 0.4}
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

      {/* PDF Preview */}
      <div className="flex-1 overflow-auto p-4">
        <BlobProvider document={pdfDocument!}>
          {({ blob, loading, error }) => {
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

            const blobUrl = URL.createObjectURL(blob);

            return (
              <div className="flex justify-center">
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
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    className="shadow-lg"
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>
            );
          }}
        </BlobProvider>
      </div>
    </div>
  );
}
