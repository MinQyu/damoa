import { Page } from "puppeteer";
import { parseShippingFee, parseWonAmount } from "../http";
import { ConditionalDiscount, VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";
import { withVendorPage, waitForRealPage } from "../browserSession";

const HOME_URL = "https://www.coupang.com/";
const PRICE_LAYOUT_SELECTOR = ".price-container-v2 .price-layout-container";
const DELIVERY_SELECTOR = ".delivery-container, [class*='shipping-fee']";

interface PriceEntry {
  text: string;
  rowText: string;
  isStrike: boolean;
}

/**
 * 쿠키 없이 상품 페이지로 바로 들어가면 CDP로 붙은 실제 Chrome도 403("사용권한이 없습니다")을
 * 받는다. 홈을 한 번 거쳐 세션 쿠키를 받으면 이후 상품 페이지는 통과한다(2026-09 검증).
 * 쿠키는 백그라운드 Chrome 프로필에 남으므로 홈 경유는 403을 받았을 때만 한다.
 */
async function gotoProductPage(page: Page, url: string): Promise<boolean> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  if (response?.status() !== 403) return true;

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2000));
  const retry = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000, referer: HOME_URL });
  return retry?.status() !== 403;
}

/**
 * 가격 영역의 "N원" 텍스트 노드를 모두 모은다. 쿠팡은 Tailwind 유틸 클래스만 써서 클래스명으로는
 * 정가/판매가를 구분하기 어려워, 정가는 계산된 스타일의 취소선으로 판별하고, 카드 즉시할인 같은
 * 조건부 가격은 같은 행(가격 레이아웃의 직계 자식)의 문구로 판별한다.
 */
async function collectPriceEntries(page: Page): Promise<PriceEntry[]> {
  return page.$$eval(PRICE_LAYOUT_SELECTOR, (containers) => {
    const container = containers[0];
    if (!container) return [];
    const entries: { text: string; rowText: string; isStrike: boolean }[] = [];
    container.querySelectorAll("*").forEach((el) => {
      const ownText = Array.from(el.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
      if (!/[\d,]+\s*원/.test(ownText)) return;

      let row: Element = el;
      while (row.parentElement && row.parentElement !== container) row = row.parentElement;

      entries.push({
        text: ownText,
        rowText: (row as HTMLElement).innerText ?? "",
        isStrike: getComputedStyle(el).textDecorationLine.includes("line-through"),
      });
    });
    return entries;
  });
}

function isConditionalEntry(entry: PriceEntry): boolean {
  return entry.text.includes("~") || entry.rowText.includes("즉시할인");
}

/**
 * 쿠팡의 카드 즉시할인 문구("1,029,800원~ 카드 즉시할인 와우 전용")에는 카드사명이 없고
 * "~"(최대 할인 기준)가 붙는다. 카드사를 특정할 수 없어 cardName은 비워 둔다.
 */
function buildCoupangConditionalDiscount(
  entry: PriceEntry | undefined,
  finalPrice: number,
  shippingFee: number | null
): ConditionalDiscount | null {
  const price = parseWonAmount(entry?.text);
  if (!entry || price === null || price >= finalPrice) return null;
  return {
    type: entry.rowText.includes("카드") ? "card" : "payment",
    cardName: null,
    price: price + (shippingFee ?? 0),
  };
}

/**
 * 쿠팡은 일반 fetch/헤드리스 puppeteer 요청 모두 403으로 차단되지만, 사용자 백그라운드의
 * 실제(headless 아닌) Chrome에 CDP로 붙어서 접근하면 통과되는 것을 확인했다 (2026-08 검증,
 * browserSession.ts 참고). 취소선이 없는 첫 금액을 판매가, 취소선 금액을 정가로 보고,
 * 카드 즉시할인가는 finalPrice에 섞지 않고 conditionalDiscount로 따로 내린다.
 */
export const fetchCoupangPrice: VendorAdapter = async (url) => {
  try {
    return await withVendorPage(async (page) => {
      if (!(await gotoProductPage(page, url))) {
        return failedResult(url, "쿠팡 접근이 차단되었습니다(403).");
      }
      await waitForRealPage(page);
      await page.waitForSelector(PRICE_LAYOUT_SELECTOR, { timeout: 8000 }).catch(() => null);

      const entries = await collectPriceEntries(page);
      const saleEntry = entries.find((e) => !e.isStrike && !isConditionalEntry(e));
      const finalPrice = parseWonAmount(saleEntry?.text);
      if (finalPrice === null) {
        return failedResult(url, "쿠팡 가격 정보를 찾지 못했습니다.");
      }
      const strikePrice = parseWonAmount(entries.find((e) => e.isStrike)?.text);
      const originalPrice = strikePrice !== null && strikePrice > finalPrice ? strikePrice : finalPrice;
      const couponDiscount = originalPrice - finalPrice;

      const deliveryText = await page
        .$eval(DELIVERY_SELECTOR, (el) => el.textContent ?? "")
        .catch(() => "");
      const shippingFee = parseShippingFee(deliveryText);

      const result: VendorPriceResult = {
        vendor: "coupang",
        vendorName: "쿠팡",
        status: "success",
        originalPrice,
        couponDiscount,
        discountType: couponDiscount > 0 ? "coupon" : "none",
        conditionalDiscount: buildCoupangConditionalDiscount(
          entries.find(isConditionalEntry),
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
    vendor: "coupang",
    vendorName: "쿠팡",
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
