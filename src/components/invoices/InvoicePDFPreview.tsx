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
    
    // Build source references and collect all unique locations
    let sourceServiceOrder = undefined;
    let sourceProject = undefined;
    // Use invoice description if set, otherwise derive from source documents
    let invoiceDescription = invoice.description || '';
    const uniqueLocations: Map<string, any> = new Map();
    
    // Build a map of source_id to location for line items
    const sourceLocationMap = new Map<string, any>();
    
    if (sourceDocuments && sourceDocuments.size > 0) {
      for (const [key, doc] of sourceDocuments) {
        if (doc.type === "service_order") {
          if (!sourceServiceOrder) {
            sourceServiceOrder = {
              order_number: doc.order_number,
              work_order_number: doc.work_order_number,
              purchase_order_number: doc.purchase_order_number,
            };
            // Only use service order description if invoice description is empty
            if (!invoiceDescription && doc.description) {
              invoiceDescription = doc.description;
            }
          }
          // Collect all locations
          if (doc.location?.name) {
            uniqueLocations.set(doc.location.name, doc.location);
            sourceLocationMap.set(doc.id, doc.location);
          }
        } else if (doc.type === "project" && !sourceProject) {
          sourceProject = { name: doc.name };
          // Only use project name if invoice description is empty
          if (!invoiceDescription && doc.name) {
            invoiceDescription = doc.name;
          }
        }
      }
    }

    // Determine Ship To based on unique locations
    let shipTo = undefined;
    if (uniqueLocations.size === 1) {
      const [, location] = [...uniqueLocations.entries()][0];
      shipTo = {
        name: location.name || '',
        address: location.address || '',
        city: location.city || '',
        state: location.state || '',
        postcode: location.postcode || '',
      };
    } else if (uniqueLocations.size > 1) {
      shipTo = {
        name: 'Multiple - as itemised below',
        address: '',
        city: '',
        state: '',
        postcode: '',
      };
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
        contact_name: customer.billing_contact_name || customer.contact_name,
        // Use billing contact address if available, otherwise customer billing address
        address: customer.billing_contact_address || customer.billing_address || customer.address || "",
        city: customer.billing_contact_city || customer.city || "",
        state: customer.billing_contact_state || customer.state || "",
        postcode: customer.billing_contact_postcode || customer.postcode || "",
        email: customer.billing_email || customer.email || "",
        phone: customer.billing_phone || customer.phone || "",
        billing_email: customer.billing_email,
        billing_phone: customer.billing_phone,
      },
      source_service_order: sourceServiceOrder,
      source_project: sourceProject,
      // Store location map for line item processing
      _sourceLocationMap: sourceLocationMap,
    } as DocumentData & { _sourceLocationMap?: Map<string, any> };
  }, [invoice, customerInfo, sourceDocuments]);

  // Convert line items with location names
  const pdfLineItems: LineItem[] = useMemo(() => {
    const extendedDocData = documentData as (DocumentData & { _sourceLocationMap?: Map<string, any> }) | null;
    const locationMap = extendedDocData?._sourceLocationMap || new Map();
    
    return (lineItems || []).map((item, index) => {
      // Get location name from source service order
      let locationName = '';
      if (item.source_type === 'service_order' && item.source_id && locationMap.has(item.source_id)) {
        locationName = locationMap.get(item.source_id)?.name || '';
      }
      
      // Prepend location name to description if we have multiple locations
      const hasMultipleLocations = locationMap.size > 1;
      const description = hasMultipleLocations && locationName 
        ? `[${locationName}] ${item.description || ''}`
        : item.description || '';
      
      return {
        id: item.id || `item-${index}`,
        description,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        line_total: item.line_total || 0,
        is_gst_free: item.is_gst_free || false,
        location_name: locationName,
      };
    });
  }, [lineItems, documentData]);

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
