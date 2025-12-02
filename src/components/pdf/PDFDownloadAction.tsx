import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { PDFDocument } from "./PDFDocument";
import { toast } from "sonner";

interface PDFDownloadActionProps {
  templateImage: string;
  data: {
    documentNumber: string;
    documentDate: string;
    customerName: string;
    customerAddress?: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    notes?: string;
    termsConditions?: string;
  };
  documentType: "quote" | "invoice" | "purchase_order" | "field_report";
  filename?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
  className?: string;
}

export const PDFDownloadAction = ({ 
  templateImage, 
  data, 
  documentType,
  filename,
  variant = "outline",
  className,
}: PDFDownloadActionProps) => {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const blob = await pdf(
        <PDFDocument 
          templateImage={templateImage} 
          data={data} 
          documentType={documentType} 
        />
      ).toBlob();
      
      const defaultFilename = `${documentType}-${data.documentNumber}.pdf`;
      saveAs(blob, filename || defaultFilename);
      
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button 
      onClick={handleDownload} 
      disabled={generating} 
      variant={variant}
      className={className}
    >
      {generating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {generating ? "Generating..." : "Download PDF"}
    </Button>
  );
};
