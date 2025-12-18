import { NextResponse } from "next/server";
import { searchAndStoreProducts } from "@/lib/actions";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { productName } = await request.json();

    if (!productName || !productName.trim()) {
      return NextResponse.json(
        { success: false, message: "Product name is required" },
        { status: 400 }
      );
    }

    // Search and store products from Amazon
    const result = await searchAndStoreProducts(productName.trim(), 20);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        count: result.count
      });
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to scrape products" },
      { status: 500 }
    );
  }
}

