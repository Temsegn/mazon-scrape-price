import { NextResponse } from "next/server";
import { runBackgroundScrapingJob } from "@/lib/actions";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Global state to track the background job
let scrapingInterval: NodeJS.Timeout | null = null;
let isScrapingActive = false;

async function runScrapingCycle() {
  if (isScrapingActive) {
    console.log('[Background Scraper] Already running a cycle, skipping...');
    return;
  }

  isScrapingActive = true;
  try {
    console.log('[Background Scraper] Starting scraping cycle...');
    const result = await runBackgroundScrapingJob(50);
    console.log(`[Background Scraper] Cycle completed: ${result.message} - Stored ${result.count} products`);
  } catch (error: any) {
    console.error('[Background Scraper] Error in cycle:', error);
  } finally {
    isScrapingActive = false;
  }
}

// This endpoint starts the infinite background scraping loop
export async function GET() {
  try {
    // If already running, return status
    if (scrapingInterval) {
      return NextResponse.json({
        success: true,
        message: "Background scraper is already running.",
        running: true
      });
    }

    // Run first cycle immediately (non-blocking)
    runScrapingCycle().catch(console.error);

    // Set up interval to run every 10 minutes
    scrapingInterval = setInterval(() => {
      runScrapingCycle().catch(console.error);
    }, 10 * 60 * 1000); // 10 minutes

    console.log('[Background Scraper] Started infinite loop - will run every 10 minutes');

    return NextResponse.json({
      success: true,
      message: "Background scraper started. It will run every 10 minutes continuously.",
      running: true
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    if (action === 'start') {
      if (scrapingInterval) {
        return NextResponse.json({
          success: true,
          message: "Background scraper is already running",
          running: true
        });
      }

      // Run first cycle immediately
      runScrapingCycle().catch(console.error);

      // Set up interval
      scrapingInterval = setInterval(() => {
        runScrapingCycle().catch(console.error);
      }, 10 * 60 * 1000);

      return NextResponse.json({
        success: true,
        message: "Background scraper started",
        running: true
      });
    } else if (action === 'stop') {
      if (scrapingInterval) {
        clearInterval(scrapingInterval);
        scrapingInterval = null;
        isScrapingActive = false;
        return NextResponse.json({
          success: true,
          message: "Background scraper stopped",
          running: false
        });
      }
      return NextResponse.json({
        success: true,
        message: "Background scraper was not running",
        running: false
      });
    } else if (action === 'run-once') {
      runScrapingCycle().catch(console.error);
      return NextResponse.json({
        success: true,
        message: "Running scraping cycle now..."
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

