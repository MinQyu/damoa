import { parseWonAmount } from "../http";
import { VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";
import { withVendorPage, waitForRealPage } from "../browserSession";

const ORIGINAL_PRICE_SELECTOR = ".price_real";
const COUPON_PRICE_SELECTOR = ".price_coupon";
const DELIVERY_SELECTOR = '[class*="delivery-info"]';

/**
 * 옥션은 G마켓과 같은 이베이코리아 인프라를 쓴다. 판매가(.price_real) 대비
 * 쿠폰적용가(.price_coupon)가 더 낮으면 그걸 실구매가로 본다. 활성 쿠폰이 없는
 * 상품은 쿠폰적용가가 판매가와 같거나 요소 자체가 없어 판매가를 그대로 쓴다.
 * (2026-08 검증, browserSession.ts 참고)
 */
export const fetchAuctionPrice: VendorAdapter = async (url) => {
  try {
    return await withVendorPage(async (page) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await waitForRealPage(page);
      await page.waitForSelector(ORIGINAL_PRICE_SELECTOR, { timeout: 8000 }).catch(() => null);

      const originalText = await page
        .$eval(ORIGINAL_PRICE_SELECTOR, (el) => el.textContent ?? "")
        .catch(() => null);
      const originalPrice = parseWonAmount(originalText);
      if (originalPrice === null) {
        return failedResult(url, "옥션 가격 정보를 찾지 못했습니다.");
      }

      const couponText = await page
        .$eval(COUPON_PRICE_SELECTOR, (el) => el.textContent ?? "")
        .catch(() => null);
      const couponPrice = parseWonAmount(couponText);
      const finalPrice = couponPrice && couponPrice < originalPrice ? couponPrice : originalPrice;
      const couponDiscount = originalPrice - finalPrice;

      const deliveryText = await page
        .$eval(DELIVERY_SELECTOR, (el) => el.textContent ?? "")
        .catch(() => "");
      const shippingFee = deliveryText.includes("무료배송") ? 0 : null;

      const result: VendorPriceResult = {
        vendor: "auction",
        vendorName: "옥션",
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
