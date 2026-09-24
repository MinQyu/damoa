import { parseWonAmount } from "../http";
import { VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";
import { withVendorPage, waitForRealPage } from "../browserSession";
import { buildConditionalDiscount } from "./discount";
import { fetchEbayKoreaShippingFee } from "./ebayKorea";

const ORIGINAL_PRICE_SELECTOR = ".price_real, .price_original";
const COUPON_PRICE_SELECTOR = ".price_coupon";
const PAYMENT_DISCOUNT_SELECTOR = ".box__payment-discount:not(.box__payment-discount--reward)";

/**
 * 옥션은 G마켓과 같은 이베이코리아 인프라를 써서 두 종류의 할인이 각각 따로 걸릴 수 있다:
 * 쿠폰적용가(.price_coupon)와 카드/결제수단 즉시할인가(.box__payment-discount, G마켓과 동일
 * 마크업). 쿠폰은 누구나 받으므로 finalPrice에 반영하고, 즉시할인은 해당 결제수단을 쓸
 * 때만 적용되므로 쿠폰가보다 더 쌀 때만 conditionalDiscount로 따로 내린다. 활성
 * 쿠폰/즉시할인이 없는 상품은 각 selector가 없거나 판매가와 같아 판매가를 그대로 쓴다.
 * 정가 표시도 상품/카테고리별로 마크업이 달라 가전 등은 .price_real, 패션 등은
 * .price_original을 쓴다(2026-08 여러 카테고리 상품 크롤링으로 확인, browserSession.ts 참고).
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

      const paymentDiscountText = await page
        .$eval(PAYMENT_DISCOUNT_SELECTOR, (el) => el.textContent ?? "")
        .catch(() => null);
      const paymentDiscountPrice = parseWonAmount(paymentDiscountText);

      const hasCoupon = couponPrice !== null && couponPrice < originalPrice;
      const finalPrice = hasCoupon ? couponPrice : originalPrice;
      const couponDiscount = originalPrice - finalPrice;

      const shippingFee = await fetchEbayKoreaShippingFee(page);

      const result: VendorPriceResult = {
        vendor: "auction",
        vendorName: "옥션",
        status: "success",
        originalPrice,
        couponDiscount,
        discountType: hasCoupon ? "coupon" : "none",
        conditionalDiscount: buildConditionalDiscount(
          paymentDiscountText,
          paymentDiscountPrice,
          finalPrice,
          shippingFee
        ),
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
    discountType: "none",
    conditionalDiscount: null,
    shippingFee: null,
    finalPrice: null,
    productUrl: url,
    error,
  };
}
