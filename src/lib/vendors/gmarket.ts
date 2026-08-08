import { fetchHtml, HttpError } from "../http";
import { VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";

/**
 * G마켓도 서버 사이드 요청/헤드리스 브라우저 요청 모두 403으로 차단되는 것을 확인했다
 * (2026-08 기준). coupang.ts와 동일한 사유로 실패를 그대로 보고한다.
 */
export const fetchGmarketPrice: VendorAdapter = async (url) => {
  try {
    await fetchHtml(url);
    return failedResult(url, "G마켓 페이지 구조가 예상과 달라 가격을 추출하지 못했습니다.");
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      return failedResult(url, "G마켓의 접근 차단(403)으로 가격을 확인할 수 없습니다.");
    }
    return failedResult(url, error instanceof Error ? error.message : "알 수 없는 오류");
  }
};

function failedResult(url: string, error: string): VendorPriceResult {
  return {
    vendor: "gmarket",
    vendorName: "G마켓",
    status: "failed",
    originalPrice: null,
    couponDiscount: null,
    shippingFee: null,
    finalPrice: null,
    productUrl: url,
    error,
  };
}
