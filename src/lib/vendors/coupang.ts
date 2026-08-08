import { fetchHtml, HttpError } from "../http";
import { VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";

/**
 * 쿠팡은 서버 사이드 요청(fetch)과 헤드리스 브라우저(puppeteer) 요청 모두
 * 봇 탐지에 의해 403(Access Denied)으로 차단되는 것을 확인했다 (2026-08 기준).
 * 실제 파싱 로직을 검증할 방법이 없어 시도 후 실패를 그대로 보고한다.
 * 추후 stealth 플러그인/프록시 등으로 우회를 시도해볼 수 있는 지점이다.
 */
export const fetchCoupangPrice: VendorAdapter = async (url) => {
  try {
    await fetchHtml(url);
    return failedResult(url, "쿠팡 페이지 구조가 예상과 달라 가격을 추출하지 못했습니다.");
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      return failedResult(url, "쿠팡의 접근 차단(403)으로 가격을 확인할 수 없습니다.");
    }
    return failedResult(url, error instanceof Error ? error.message : "알 수 없는 오류");
  }
};

function failedResult(url: string, error: string): VendorPriceResult {
  return {
    vendor: "coupang",
    vendorName: "쿠팡",
    status: "failed",
    originalPrice: null,
    couponDiscount: null,
    shippingFee: null,
    finalPrice: null,
    productUrl: url,
    error,
  };
}
