export interface SearchResultItem {
  id: number;
  title: string;
  imageUrl: string | null;
  specSummary: string;
  danawaPrice: number | null;
  danawaUrl: string;
}

export type VendorKey = "coupang" | "gmarket" | "auction" | "elevenst";

export const VENDOR_LABELS: Record<VendorKey, string> = {
  coupang: "쿠팡",
  gmarket: "G마켓",
  auction: "옥션",
  elevenst: "11번가",
};

export type VendorUrls = Record<VendorKey, string | null>;

/**
 * "pending"은 서버가 내리는 상태가 아니라, 스트리밍 조회 중 아직 해당 벤더의
 * 결과가 도착하지 않았을 때 클라이언트가 채워 넣는 임시 상태다.
 */
export type VendorPriceStatus = "success" | "failed" | "unavailable" | "pending";

/**
 * "card": 특정 카드사 결제 시 즉시할인(cardName에 카드사명이 채워짐).
 * "payment": 카드사를 특정할 수 없는 결제수단(스마일페이 등) 즉시할인.
 * "coupon": 쿠폰 적용가로 인한 할인.
 * "none": 할인 없음(표시가 그대로가 실구매가).
 */
export type DiscountType = "card" | "payment" | "coupon" | "none";

export interface VendorPriceResult {
  vendor: VendorKey;
  vendorName: string;
  status: VendorPriceStatus;
  originalPrice: number | null;
  couponDiscount: number | null;
  discountType: DiscountType;
  cardName: string | null;
  shippingFee: number | null;
  finalPrice: number | null;
  productUrl: string | null;
  error?: string;
}

export interface ProductPriceComparison {
  productId: number;
  results: VendorPriceResult[];
  lowestPrice: VendorPriceResult | null;
}
