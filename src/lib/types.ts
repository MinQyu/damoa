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
 * 누구나 받을 수 있는 공통 할인 종류. 이 할인만 finalPrice에 반영된다.
 * "coupon": 쿠폰 적용가로 인한 할인.
 * "none": 공통 할인 없음(표시가 그대로가 실구매가).
 */
export type DiscountType = "coupon" | "none";

/**
 * 특정 결제수단을 써야만 받을 수 있어 사용자마다 적용 여부가 달라지는 할인
 * (overview.md 4.4절). 누구나 받는 공통 실구매가(finalPrice)와 섞지 않고 따로 보여준다.
 * "card": 특정 카드사 결제 시 즉시할인(cardName에 카드사명이 채워짐).
 * "payment": 카드사를 특정할 수 없는 결제수단(스마일페이 등) 즉시할인.
 */
export interface ConditionalDiscount {
  type: "card" | "payment";
  cardName: string | null;
  /** 이 조건을 충족했을 때의 결제가(배송비 포함). 항상 finalPrice보다 낮다. */
  price: number;
}

export interface VendorPriceResult {
  vendor: VendorKey;
  vendorName: string;
  status: VendorPriceStatus;
  originalPrice: number | null;
  couponDiscount: number | null;
  discountType: DiscountType;
  conditionalDiscount: ConditionalDiscount | null;
  shippingFee: number | null;
  finalPrice: number | null;
  productUrl: string | null;
  error?: string;
}

export interface ProductPriceComparison {
  productId: number;
  results: VendorPriceResult[];
  /** 공통 실구매가(finalPrice) 기준 최저가. */
  lowestPrice: VendorPriceResult | null;
  /** 조건부 할인까지 적용하면 lowestPrice보다 더 싸지는 판매처. 없으면 null. */
  lowestConditionalPrice: VendorPriceResult | null;
}
