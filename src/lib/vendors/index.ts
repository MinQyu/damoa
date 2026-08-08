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
    shippingFee: null,
    finalPrice: null,
    productUrl: null,
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

  const settled = await Promise.allSettled(
    vendors.map((vendor) => {
      const url = vendorUrls[vendor];
      if (!url) return Promise.resolve(unavailableResult(vendor));
      return fetchVendorPriceCached(vendor, url);
    })
  );

  const results: VendorPriceResult[] = settled.map((outcome, i) =>
    outcome.status === "fulfilled"
      ? outcome.value
      : {
          vendor: vendors[i],
          vendorName: VENDOR_LABELS[vendors[i]],
          status: "failed",
          originalPrice: null,
          couponDiscount: null,
          shippingFee: null,
          finalPrice: null,
          productUrl: vendorUrls[vendors[i]],
          error: outcome.reason instanceof Error ? outcome.reason.message : "알 수 없는 오류",
        }
  );

  const lowestPrice = results
    .filter((r) => r.status === "success" && r.finalPrice !== null)
    .reduce<VendorPriceResult | null>((lowest, current) => {
      if (!lowest) return current;
      return (current.finalPrice as number) < (lowest.finalPrice as number) ? current : lowest;
    }, null);

  return { productId, results, lowestPrice };
}
