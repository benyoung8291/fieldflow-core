import { supabase } from "@/integrations/supabase/client";

export async function exportArticleToPDF(articleId: string, articleTitle: string) {
  try {
    const { data, error } = await supabase.functions.invoke("export-article-pdf", {
      body: { articleId },
    });

    if (error) throw error;

    // The edge function returns HTML for printing
    // Open in new window and trigger print dialog
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
    }
    
    printWindow.document.write(data);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    
    return { success: true };
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    return { success: false, error };
  }
}
