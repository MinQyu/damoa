import { ProductPriceComparison, VendorKey, VendorPriceResult, VendorUrls } from "../types";
import { vendorPriceCache } from "../cache";
import { VendorAdapter } from "./types";
import { fetchCoupangPrice } from "./coupang";
import { fetchGmarketPrice } from "./gmarket";
import { fetchAuctionPrice } from "./auction";
import { fetchElevenstPrice } from "./elevenst";

const VENDOR_ADAPTERS: Record<VendorKey, VendorAdapter> = {
  coupang: fetchCoupangPrice,
  gmarket: fetchGmarketPrice,
  auction: fetchAuctionPrice,
  elevenst: fetchElevenstPrice,
};

const VENDOR_LABELS: Record<VendorKey, string> = {
  coupang: "쿠팡",
  gmarket: "G마켓",
  auction: "옥션",
  elevenst: "11번가",
};

async function fetchVendorPriceCached(vendor: VendorKey, url: string): Promise<VendorPriceResult> {
  const cached = vendorPriceCache.get(url);
  if (cached) return cached;

  const result = await VENDOR_ADAPTERS[vendor](url);
  if (result.status === "success") {
    vendorPriceCache.set(url, result);
  }
  return result;
}

function unavailableResult(vendor: VendorKey): VendorPriceResult {
  return {
    vendor,
    vendorName: VENDOR_LABELS[vendor],
    status: "unavailable",
    originalPrice: null,
    couponDiscount: null,
    discountType: "none",
    conditionalDiscount: null,
    shippingFee: null,
    finalPrice: null,
    productUrl: null,
  };
}

function failedResult(vendor: VendorKey, url: string | null, error: unknown): VendorPriceResult {
  return {
    vendor,
    vendorName: VENDOR_LABELS[vendor],
    status: "failed",
    originalPrice: null,
    couponDiscount: null,
    discountType: "none",
    conditionalDiscount: null,
    shippingFee: null,
    finalPrice: null,
    productUrl: url,
    error: error instanceof Error ? error.message : "알 수 없는 오류",
  };
}

/**
 * 한 벤더의 가격 조회를 실행하고, 실패하더라도 throw하지 않고 failed 상태의
 * VendorPriceResult로 감싸 반환한다. allSettled/스트리밍 양쪽에서 공유하는 핵심 로직.
 */
async function resolveVendorPrice(vendor: VendorKey, url: string | null): Promise<VendorPriceResult> {
  if (!url) return unavailableResult(vendor);
  try {
    return await fetchVendorPriceCached(vendor, url);
  } catch (error) {
    return failedResult(vendor, url, error);
  }
}

function computeLowestPrice(results: VendorPriceResult[]): VendorPriceResult | null {
  return results
    .filter((r) => r.status === "success" && r.finalPrice !== null)
    .reduce<VendorPriceResult | null>((lowest, current) => {
      if (!lowest) return current;
      return (current.finalPrice as number) < (lowest.finalPrice as number) ? current : lowest;
    }, null);
}

/**
 * 조건부 할인은 사용자마다 적용 여부가 달라 최저가 판정에서는 빼되, 그 결제수단을 가진
 * 사용자에게는 더 싼 선택지가 되므로 공통 최저가보다 낮을 때만 따로 알려준다.
 */
function computeLowestConditionalPrice(
  results: VendorPriceResult[],
  lowestPrice: VendorPriceResult | null
): VendorPriceResult | null {
  const threshold = lowestPrice?.finalPrice ?? Infinity;
  return results
    .filter((r) => r.status === "success" && r.conditionalDiscount && r.conditionalDiscount.price < threshold)
    .reduce<VendorPriceResult | null>((lowest, current) => {
      if (!lowest) return current;
      return current.conditionalDiscount!.price < lowest.conditionalDiscount!.price ? current : lowest;
    }, null);
}

function buildComparison(productId: number, results: VendorPriceResult[]): ProductPriceComparison {
  const lowestPrice = computeLowestPrice(results);
  return {
    productId,
    results,
    lowestPrice,
    lowestConditionalPrice: computeLowestConditionalPrice(results, lowestPrice),
  };
}

/**
 * 오픈마켓별 실구매가 조회를 병렬로 실행하고, 일부가 실패해도 나머지 결과는
 * 정상적으로 반환한다 (overview.md 7절 "비동기 데이터 처리" 참고).
 */
export async function fetchAllVendorPrices(
  productId: number,
  vendorUrls: VendorUrls
): Promise<ProductPriceComparison> {
  const vendors = Object.keys(vendorUrls) as VendorKey[];
  const results = await Promise.all(vendors.map((vendor) => resolveVendorPrice(vendor, vendorUrls[vendor])));

  return buildComparison(productId, results);
}

/**
 * fetchAllVendorPrices와 동일하게 병렬 조회하되, 벤더별 조회가 끝날 때마다
 * onResult로 그 결과를 즉시 통지한다 (overview.md 7절 "크롤링 상태 UX" 참고).
 * SSE 스트리밍 라우트에서 사용한다.
 */
export async function streamVendorPrices(
  productId: number,
  vendorUrls: VendorUrls,
  onResult: (result: VendorPriceResult) => void
): Promise<ProductPriceComparison> {
  const vendors = Object.keys(vendorUrls) as VendorKey[];

  const results = await Promise.all(
    vendors.map(async (vendor) => {
      const result = await resolveVendorPrice(vendor, vendorUrls[vendor]);
      onResult(result);
      return result;
    })
  );

  return buildComparison(productId, results);
}
