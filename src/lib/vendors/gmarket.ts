import { parseWonAmount } from "../http";
import { VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";
import { withVendorPage, waitForRealPage } from "../browserSession";
import { buildConditionalDiscount } from "./discount";
import { fetchEbayKoreaShippingFee } from "./ebayKorea";

const ORIGINAL_PRICE_SELECTOR = ".price_real";
const PAYMENT_DISCOUNT_SELECTOR = ".box__payment-discount:not(.box__payment-discount--reward)";

/**
 * G마켓은 실제 Chrome CDP 연결로는 접근되지만 첫 진입 시 "봇 확인 중" 인터스티셜을
 * 거친다(2026-08 검증, browserSession.ts#waitForRealPage 참고). 판매가(.price_real)가
 * 누구나 받는 실구매가이고, 카드/결제수단 즉시할인가(.box__payment-discount)는 해당
 * 결제수단을 쓸 때만 적용되므로 finalPrice에 섞지 않고 conditionalDiscount로 따로 내린다.
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

      const shippingFee = await fetchEbayKoreaShippingFee(page);

      const result: VendorPriceResult = {
        vendor: "gmarket",
        vendorName: "G마켓",
        status: "success",
        originalPrice,
        couponDiscount: 0,
        discountType: "none",
        conditionalDiscount: buildConditionalDiscount(discountText, discountPrice, originalPrice, shippingFee),
        shippingFee,
        finalPrice: originalPrice + (shippingFee ?? 0),
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
    conditionalDiscount: null,
    shippingFee: null,
    finalPrice: null,
    productUrl: url,
    error,
  };
}
