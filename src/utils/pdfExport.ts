import { supabase } from "@/integrations/supabase/client";

export async function exportArticleToPDF(articleId: string, articleTitle: string) {
  try {
    const { data, error } = await supabase.functions.invoke("export-article-pdf", {
      body: { articleId },
    });

    if (error) throw error;

    // Create a blob from the PDF data
    const blob = new Blob([data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary link and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = `${articleTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
    return { success: true };
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    return { success: false, error };
  }
}
