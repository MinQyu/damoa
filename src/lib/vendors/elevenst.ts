import * as cheerio from "cheerio";
import { fetchHtml } from "../http";
import { VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";

/**
 * 11번가는 SSR로 렌더링되어 정적 fetch만으로 실구매가를 확인할 수 있다.
 * og:description meta에 "가격 : N원" 형태로 할인이 반영된 최종가가 노출된다.
 */
export const fetchElevenstPrice: VendorAdapter = async (url) => {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const ogDescription = $('meta[property="og:description"]').attr("content") ?? "";
    const finalMatch = ogDescription.match(/가격\s*:\s*([\d,]+)\s*원/);
    const finalPrice = finalMatch ? parseInt(finalMatch[1].replace(/,/g, ""), 10) : null;

    if (finalPrice === null) {
      return failedResult(url, "가격 정보를 찾을 수 없습니다.");
    }

    const strikeThroughText = $(".price_regular del").first().text();
    const strikeMatch = strikeThroughText.match(/([\d,]+)\s*원/);
    const originalPrice = strikeMatch
      ? parseInt(strikeMatch[1].replace(/,/g, ""), 10)
      : finalPrice;

    const couponDiscount = originalPrice > finalPrice ? originalPrice - finalPrice : 0;

    const deliveryText = $(".delivery").first().text();
    const shippingFee = deliveryText.includes("무료배송") ? 0 : null;

    return {
      vendor: "elevenst",
      vendorName: "11번가",
      status: "success",
      originalPrice,
      couponDiscount,
      discountType: couponDiscount > 0 ? "coupon" : "none",
      conditionalDiscount: null,
      shippingFee,
      finalPrice: finalPrice + (shippingFee ?? 0),
      productUrl: url,
    };
  } catch (error) {
    return failedResult(url, error instanceof Error ? error.message : "알 수 없는 오류");
  }
};

function failedResult(url: string, error: string): VendorPriceResult {
  return {
    vendor: "elevenst",
    vendorName: "11번가",
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
