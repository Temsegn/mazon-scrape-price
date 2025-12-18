import { NextResponse } from "next/server";
import { runBackgroundScrapingJob } from "@/lib/actions";

export const maxDuration = 300; // 5 minutes max per request
export const dynamic = "force-dynamic";

// Global flag to track if background job is running
let isRunning = false;
let jobInterval: NodeJS.Timeout | null = null;

async function runScrapingCycle() {
  if (isRunning) {
    console.log('[Background Scraper] Job already running, skipping...');
    return;
  }

  isRunning = true;
  try {
    console.log('[Background Scraper] Starting scraping cycle...');
    const result = await runBackgroundScrapingJob(50);
    console.log(`[Background Scraper] Cycle completed: ${result.message}`);
  } catch (error: any) {
    console.error('[Background Scraper] Error in cycle:', error);
  } finally {
    isRunning = false;
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    if (action === 'start') {
      if (jobInterval) {
        return NextResponse.json({
          success: true,
          message: "Background scraper is already running",
          running: true
        });
      }

      // Run immediately
      runScrapingCycle().catch(console.error);

      // Then run every 10 minutes
      jobInterval = setInterval(() => {
        runScrapingCycle().catch(console.error);
      }, 10 * 60 * 1000); // 10 minutes

      return NextResponse.json({
        success: true,
        message: "Background scraper started. Will run every 10 minutes.",
        running: true
      });
    } else if (action === 'stop') {
      if (jobInterval) {
        clearInterval(jobInterval);
        jobInterval = null;
        isRunning = false;
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
    } else if (action === 'status') {
      return NextResponse.json({
        success: true,
        running: jobInterval !== null,
        currentlyScraping: isRunning
      });
    } else if (action === 'run-once') {
      // Run a single cycle immediately
      runScrapingCycle().catch(console.error);
      return NextResponse.json({
        success: true,
        message: "Running scraping cycle now..."
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid action. Use 'start', 'stop', 'status', or 'run-once'" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  // Start the background scraper if not already running
  if (!jobInterval) {
    // Run immediately
    runScrapingCycle().catch(console.error);

    // Then run every 10 minutes
    jobInterval = setInterval(() => {
      runScrapingCycle().catch(console.error);
    }, 10 * 60 * 1000); // 10 minutes

    return NextResponse.json({
      success: true,
      message: "Background scraper started via GET request. Will run every 10 minutes.",
      running: true
    });
  }

  return NextResponse.json({
    success: true,
    message: "Background scraper is already running",
    running: true
  });
}

