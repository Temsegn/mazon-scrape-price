import { NextResponse } from "next/server";
import { runBackgroundScrapingJob } from "@/lib/actions";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Bulk scraping endpoint for high-volume scraping
export async function POST(request: Request) {
  try {
    const { batchSize = 1000, cycles = 1 } = await request.json();

    const results = [];
    
    for (let i = 0; i < cycles; i++) {
      console.log(`[Bulk Scrape] Starting cycle ${i + 1}/${cycles}...`);
      const result = await runBackgroundScrapingJob(batchSize);
      results.push(result);
      
      if (i < cycles - 1) {
        // Small delay between cycles
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    const totalStored = results.reduce((sum, r) => sum + (r.count || 0), 0);

    return NextResponse.json({
      success: true,
      message: `Bulk scraping completed: ${totalStored} products stored across ${cycles} cycles`,
      totalStored,
      cycles: results
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Start a single bulk scrape cycle
  try {
    const result = await runBackgroundScrapingJob(1000);
    
    return NextResponse.json({
      success: true,
      message: result.message,
      count: result.count
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

