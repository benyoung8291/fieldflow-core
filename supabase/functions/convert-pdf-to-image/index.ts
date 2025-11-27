import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { floorPlanId, filePath } = await req.json();

    if (!floorPlanId || !filePath) {
      throw new Error('Missing floorPlanId or filePath');
    }

    console.log('Converting PDF to image:', { floorPlanId, filePath });

    // Download the PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('floor-plans')
      .download(filePath);

    if (downloadError) {
      console.error('Error downloading PDF:', downloadError);
      throw downloadError;
    }

    // Convert blob to array buffer
    const pdfBuffer = await pdfData.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

    // Use deno-canvas to create canvas
    const { createCanvas } = await import('https://deno.land/x/canvas@v1.4.1/mod.ts');
    
    // Load PDF.js for rendering
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.269/legacy/build/pdf.mjs');
    
    // Set up PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.269/legacy/build/pdf.worker.mjs';

    // Load the PDF
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    
    // Get first page
    const page = await pdf.getPage(1);
    
    // Use higher scale for better quality (2x for retina displays)
    const scale = 2;
    const viewport = page.getViewport({ scale });
    
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    
    // Render the page
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    
    console.log('PDF rendered to canvas successfully');
    
    // Encode canvas to PNG using deno-canvas encode function
    const pngData = canvas.toBuffer('image/png');
    
    if (!pngData) {
      throw new Error('Failed to encode canvas to PNG');
    }

    // Upload the image to storage
    const imageFileName = filePath.replace(/\.pdf$/i, '.png');
    
    const { error: uploadError } = await supabase.storage
      .from('floor-plans')
      .upload(imageFileName, pngData, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      throw uploadError;
    }

    // Get public URL for the image
    const { data: { publicUrl } } = supabase.storage
      .from('floor-plans')
      .getPublicUrl(imageFileName);

    // Update the floor_plans record with the image URL
    const { error: updateError } = await supabase
      .from('floor_plans')
      .update({ image_url: publicUrl })
      .eq('id', floorPlanId);

    if (updateError) {
      console.error('Error updating floor plan record:', updateError);
      throw updateError;
    }

    console.log('PDF converted successfully to:', publicUrl);

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in convert-pdf-to-image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
