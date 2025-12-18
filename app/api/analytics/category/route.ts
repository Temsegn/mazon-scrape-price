import { NextResponse } from "next/server";
import { getCategoryAnalysis } from "@/lib/actions/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCategoryAnalysis();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

