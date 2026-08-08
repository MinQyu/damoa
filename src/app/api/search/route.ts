import { NextRequest, NextResponse } from "next/server";
import { searchDanawa } from "@/lib/danawa";
import { searchCache } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ error: "검색어(q)가 필요합니다." }, { status: 400 });
  }

  const cached = searchCache.get(query);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const results = await searchDanawa(query);
    searchCache.set(query, results);
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "검색에 실패했습니다." },
      { status: 502 }
    );
  }
}
