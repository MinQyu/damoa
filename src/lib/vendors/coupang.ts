import { parseWonAmount } from "../http";
import { VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";
import { withVendorPage, waitForRealPage } from "../browserSession";

const PRICE_CONTAINER_SELECTOR = ".price-container-v2";
const DELIVERY_SELECTOR = '[class*="delivery"], [class*="shipping"]';

/**
 * 쿠팡은 일반 fetch/헤드리스 puppeteer 요청 모두 403으로 차단되지만, 사용자 백그라운드의
 * 실제(headless 아닌) Chrome에 CDP로 붙어서 접근하면 통과되는 것을 확인했다 (2026-08 검증,
 * browserSession.ts 참고). .price-container-v2 안의 텍스트에서 "N원" 금액을 순서대로
 * 추출해 첫 번째를 실구매가, 취소선 표기가 있는 더 큰 금액을 정가로 판단한다.
 */
export const fetchCoupangPrice: VendorAdapter = async (url) => {
  try {
    return await withVendorPage(async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await waitForRealPage(page);
      await page.waitForSelector(PRICE_CONTAINER_SELECTOR, { timeout: 8000 }).catch(() => null);

      const priceText = await page
        .$eval(PRICE_CONTAINER_SELECTOR, (el) => el.textContent ?? "")
        .catch(() => "");
      const amounts = Array.from(priceText.matchAll(/[\d,]+원/g)).map((m) => parseWonAmount(m[0]));

      const finalPrice = amounts[0] ?? null;
      if (finalPrice === null) {
        return failedResult(url, "쿠팡 가격 정보를 찾지 못했습니다.");
      }
      const originalPrice = amounts[1] && amounts[1] > finalPrice ? amounts[1] : finalPrice;
      const couponDiscount = originalPrice - finalPrice;

      const deliveryText = await page
        .$eval(DELIVERY_SELECTOR, (el) => el.textContent ?? "")
        .catch(() => "");
      const shippingFee = deliveryText.includes("무료배송") ? 0 : null;

      const result: VendorPriceResult = {
        vendor: "coupang",
        vendorName: "쿠팡",
        status: "success",
        originalPrice,
        couponDiscount,
        shippingFee,
        finalPrice: finalPrice + (shippingFee ?? 0),
        productUrl: url,
      };
      return result;
    });
  } catch (error) {
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
