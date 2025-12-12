import { useState, useMemo, useRef, useEffect } from 'react';
import { BlobProvider } from '@react-pdf/renderer';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Loader2, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { saveAs } from 'file-saver';
import { InvoicePDFDocument } from './InvoicePDFDocument';
import type { DocumentData, LineItem, CompanySettings, UnifiedTemplate } from '@/lib/pdf/types';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface InvoicePDFPreviewProps {
  invoice: any;
  lineItems: any[];
  sourceDocuments?: Map<string, any>;
  companySettings: CompanySettings | null;
  template: UnifiedTemplate | null;
  customerInfo?: any;
}

const A4_WIDTH_PT = 595;

export function InvoicePDFPreview({ 
  invoice, 
  lineItems, 
  sourceDocuments,
  companySettings, 
  template,
  customerInfo 
}: InvoicePDFPreviewProps) {
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
        const padding = 32;
        const optimalScale = (containerWidth - padding) / A4_WIDTH_PT;
        const clampedScale = Math.min(Math.max(optimalScale, 0.3), 1.5);
        setScale(clampedScale);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Build document data for PDF
  const documentData: DocumentData | null = useMemo(() => {
    if (!invoice) return null;
    
    const customer = customerInfo || invoice.customers || {};
    
    // Build source references and extract description/location
    let sourceServiceOrder = undefined;
    let sourceProject = undefined;
    let invoiceDescription = '';
    let shipTo = undefined;
    
    if (sourceDocuments && sourceDocuments.size > 0) {
      for (const [, doc] of sourceDocuments) {
        if (doc.type === "service_order" && !sourceServiceOrder) {
          sourceServiceOrder = {
            order_number: doc.order_number,
            work_order_number: doc.work_order_number,
            purchase_order_number: doc.purchase_order_number,
          };
          // Use service order description as invoice description
          if (doc.description) {
            invoiceDescription = doc.description;
          }
          // Get location from service order
          if (doc.location) {
            shipTo = {
              name: doc.location.name || '',
              address: doc.location.address || '',
              city: doc.location.city || '',
              state: doc.location.state || '',
              postcode: doc.location.postcode || '',
            };
          }
        } else if (doc.type === "project" && !sourceProject) {
          sourceProject = { name: doc.name };
          if (!invoiceDescription && doc.name) {
            invoiceDescription = doc.name;
          }
        }
      }
    }

    return {
      document_number: invoice.invoice_number || '',
      document_date: invoice.invoice_date || new Date().toISOString(),
      due_date: invoice.due_date || undefined,
      payment_terms: invoice.payment_terms || "Due on Receipt",
      subtotal: invoice.subtotal || 0,
      tax_amount: invoice.tax_amount || 0,
      total: invoice.total_amount || 0,
      amount_paid: invoice.amount_paid || 0,
      notes: invoice.notes,
      customer_id: customer.acumatica_customer_id || customer.id?.substring(0, 8)?.toUpperCase(),
      invoice_description: invoiceDescription,
      ship_to: shipTo,
      customer: {
        name: customer.name || "",
        legal_name: customer.legal_company_name,
        trading_name: customer.trading_name,
        abn: customer.abn,
        contact_name: customer.contact_name,
        address: customer.billing_address || customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        postcode: customer.postcode || "",
        email: customer.email || "",
        phone: customer.billing_phone || customer.phone || "",
        billing_email: customer.billing_email,
        billing_phone: customer.billing_phone,
      },
      source_service_order: sourceServiceOrder,
      source_project: sourceProject,
    };
  }, [invoice, customerInfo, sourceDocuments]);

  // Convert line items
  const pdfLineItems: LineItem[] = useMemo(() => {
    return (lineItems || []).map((item, index) => ({
      id: item.id || `item-${index}`,
      description: item.description || "",
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      line_total: item.line_total || 0,
      is_gst_free: item.is_gst_free || false,
    }));
  }, [lineItems]);

  // Memoize the PDF document
  const pdfDocument = useMemo(() => {
    if (!documentData || !companySettings || !template) return null;
    
    return (
      <InvoicePDFDocument
        documentData={documentData}
        lineItems={pdfLineItems}
        companySettings={companySettings}
        template={template}
      />
    );
  }, [documentData, pdfLineItems, companySettings, template]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.1, 2));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.3));

  const handleDownload = () => {
    if (currentBlob && invoice) {
      const filename = `Invoice-${invoice.invoice_number || 'draft'}.pdf`;
      saveAs(currentBlob, filename);
    }
  };

  if (!invoice || !companySettings || !template) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          <p className="text-sm">Loading preview...</p>
        </div>
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

      {/* PDF Preview */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4">
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

            // Store blob for download
            if (blob !== currentBlob) {
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
