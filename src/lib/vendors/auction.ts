import { fetchHtml, HttpError } from "../http";
import { VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";

/**
 * 옥션은 대부분 403으로 차단되지만 간헐적으로 요청이 통과하는 사례가 확인됐다
 * (G마켓과 같은 인프라를 쓰지만 차단 정책이 더 느슨한 것으로 보임, 2026-08 기준).
 * 성공 시에도 실제 렌더링된 가격 셀렉터를 검증하지 못해 파싱은 시도하지 않고
 * 접근 가능 여부만 우선 보고한다.
 */
export const fetchAuctionPrice: VendorAdapter = async (url) => {
  try {
    await fetchHtml(url);
    return failedResult(url, "옥션 페이지 구조가 예상과 달라 가격을 추출하지 못했습니다.");
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) {
      return failedResult(url, "옥션의 접근 차단(403)으로 가격을 확인할 수 없습니다.");
    }
    return failedResult(url, error instanceof Error ? error.message : "알 수 없는 오류");
  }
};

function failedResult(url: string, error: string): VendorPriceResult {
  return {
    vendor: "auction",
    vendorName: "옥션",
    status: "failed",
    originalPrice: null,
    couponDiscount: null,
    shippingFee: null,
    finalPrice: null,
    productUrl: url,
    error,
  };
}
