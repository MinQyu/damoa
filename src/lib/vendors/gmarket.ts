import { parseWonAmount } from "../http";
import { VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";
import { withVendorPage, waitForRealPage } from "../browserSession";
import { extractCardName, resolveInstantDiscountType } from "./discount";

const ORIGINAL_PRICE_SELECTOR = ".price_real";
const PAYMENT_DISCOUNT_SELECTOR = ".box__payment-discount:not(.box__payment-discount--reward)";
const DELIVERY_SELECTOR = '[class*="delivery-info"]';

/**
 * G마켓은 실제 Chrome CDP 연결로는 접근되지만 첫 진입 시 "봇 확인 중" 인터스티셜을
 * 거친다(2026-08 검증, browserSession.ts#waitForRealPage 참고). 판매가(.price_real) 대비
 * 카드 결제수단 즉시할인가(.box__payment-discount)가 더 낮으면 그걸 실구매가로 본다.
 * 이 즉시할인이 없는 상품도 있어 그 경우 판매가를 그대로 실구매가로 취급한다.
 */
export const fetchGmarketPrice: VendorAdapter = async (url) => {
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
        return failedResult(url, "G마켓 가격 정보를 찾지 못했습니다.");
      }

      const discountText = await page
        .$eval(PAYMENT_DISCOUNT_SELECTOR, (el) => el.textContent ?? "")
        .catch(() => null);
      const discountPrice = parseWonAmount(discountText);
      const hasInstantDiscount = discountPrice !== null && discountPrice < originalPrice;
      const finalPrice = hasInstantDiscount ? discountPrice : originalPrice;
      const couponDiscount = originalPrice - finalPrice;
      const cardName = hasInstantDiscount ? extractCardName(discountText ?? "") : null;
      const discountType = hasInstantDiscount ? resolveInstantDiscountType(cardName) : "none";

      const deliveryText = await page
        .$eval(DELIVERY_SELECTOR, (el) => el.textContent ?? "")
        .catch(() => "");
      const shippingFee = deliveryText.includes("무료배송") ? 0 : null;

      const result: VendorPriceResult = {
        vendor: "gmarket",
        vendorName: "G마켓",
        status: "success",
        originalPrice,
        couponDiscount,
        discountType,
        cardName,
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
    vendor: "gmarket",
    vendorName: "G마켓",
    status: "failed",
    originalPrice: null,
    couponDiscount: null,
    discountType: "none",
    cardName: null,
    shippingFee: null,
    finalPrice: null,
    productUrl: url,
    error,
  };
}
