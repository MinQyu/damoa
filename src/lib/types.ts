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

export type VendorPriceStatus = "success" | "failed" | "unavailable";

export interface VendorPriceResult {
  vendor: VendorKey;
  vendorName: string;
  status: VendorPriceStatus;
  originalPrice: number | null;
  couponDiscount: number | null;
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
