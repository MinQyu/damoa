import { NextRequest, NextResponse } from "next/server";
import { fetchVendorUrls } from "@/lib/danawa";
import { vendorUrlCache } from "@/lib/cache";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const productId = parseInt(params.id, 10);
  if (!productId) {
    return NextResponse.json({ error: "유효하지 않은 상품 ID입니다." }, { status: 400 });
  }

  const cacheKey = String(productId);
  const cached = vendorUrlCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const vendorUrls = await fetchVendorUrls(productId);
    vendorUrlCache.set(cacheKey, vendorUrls);
    return NextResponse.json(vendorUrls);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "판매처 조회에 실패했습니다." },
      { status: 502 }
    );
  }
}
