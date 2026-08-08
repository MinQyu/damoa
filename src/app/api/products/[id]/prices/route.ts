import { NextRequest, NextResponse } from "next/server";
import { fetchVendorUrls } from "@/lib/danawa";
import { fetchAllVendorPrices } from "@/lib/vendors";
import { vendorUrlCache } from "@/lib/cache";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const productId = parseInt(params.id, 10);
  if (!productId) {
    return NextResponse.json({ error: "유효하지 않은 상품 ID입니다." }, { status: 400 });
  }

  try {
    const cacheKey = String(productId);
    const vendorUrls = vendorUrlCache.get(cacheKey) ?? (await fetchVendorUrls(productId));
    vendorUrlCache.set(cacheKey, vendorUrls);

    const comparison = await fetchAllVendorPrices(productId, vendorUrls);
    return NextResponse.json(comparison);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "가격 비교에 실패했습니다." },
      { status: 502 }
    );
  }
}
