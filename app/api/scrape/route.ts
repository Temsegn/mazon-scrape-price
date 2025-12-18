import { NextResponse } from "next/server";
import { searchAndStoreProducts } from "@/lib/actions";

export const maxDuration = 300; // 5 minutes max
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { searchQuery, maxProducts } = await request.json();

    if (!searchQuery) {
      return NextResponse.json(
        { success: false, message: "Search query is required" },
        { status: 400 }
      );
    }

    // Run scraping in background (non-blocking)
    // Don't await - let it run in background
    searchAndStoreProducts(searchQuery, maxProducts || 20)
      .then((result) => {
        console.log(`Background scraping completed: ${result.message}`);
      })
      .catch((error) => {
        console.error("Background scraping error:", error);
      });

    return NextResponse.json({
      success: true,
      message: `Started background scraping for "${searchQuery}". Products will be stored when ready.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("query");
    const maxProducts = parseInt(searchParams.get("maxProducts") || "20");

    if (!searchQuery) {
      return NextResponse.json(
        { success: false, message: "Search query parameter is required" },
        { status: 400 }
      );
    }

    // Run scraping in background
    searchAndStoreProducts(searchQuery, maxProducts)
      .then((result) => {
        console.log(`Background scraping completed: ${result.message}`);
      })
      .catch((error) => {
        console.error("Background scraping error:", error);
      });

    return NextResponse.json({
      success: true,
      message: `Started background scraping for "${searchQuery}". Products will be stored when ready.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

