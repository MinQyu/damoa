import { HTTPResponse, Page } from "puppeteer";
import { parseShippingFee, parseWonAmount } from "../http";
import { ConditionalDiscount, VendorPriceResult } from "../types";
import { VendorAdapter } from "./types";
import { withSharedVendorPage, waitForRealPage } from "../browserSession";

const HOME_URL = "https://www.coupang.com/";
const PRICE_LAYOUT_SELECTOR = ".price-container-v2 .price-layout-container";
const DELIVERY_SELECTOR = ".delivery-container, [class*='shipping-fee']";

interface PriceEntry {
  text: string;
  rowText: string;
  isStrike: boolean;
}

/**
 * 쿠팡의 403은 두 층에서 온다(2026-09 분석, vendor-bot-bypass 스킬 참고).
 * "origin": Akamai는 통과했지만 쿠팡 원서버(server: envoy)가 거부. 세션 없이 상품 페이지로
 *   바로 들어갈 때 확률적으로 나며, 홈을 한 번 거치면 풀린다.
 * "akamai": Akamai Bot Manager(server: AkamaiGHost)가 세션을 봇으로 판정. 홈 경유나 쿠키
 *   삭제로는 풀리지 않고 백그라운드 Chrome 프로세스를 재시작해야 풀린다.
 */
type CoupangBlock = "origin" | "akamai";

function detectBlock(response: HTTPResponse | null): CoupangBlock | null {
  if (response?.status() !== 403) return null;
  return response.headers().server?.includes("AkamaiGHost") ? "akamai" : "origin";
}

const BLOCK_MESSAGES: Record<CoupangBlock, string> = {
  origin: "쿠팡이 요청을 거부했습니다(403). 잠시 후 다시 시도해 주세요.",
  akamai: "쿠팡 봇 탐지(Akamai)에 차단되었습니다(403). 백그라운드 Chrome을 재시작해야 할 수 있습니다.",
};

/** 상품 페이지로 이동하고, 차단됐다면 그 종류를 반환한다. 홈 경유 재시도는 효과가 있는 origin 차단에만 한다. */
async function gotoProductPage(page: Page, url: string): Promise<CoupangBlock | null> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  const block = detectBlock(response);
  if (block !== "origin") return block;

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2000));
  const retry = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000, referer: HOME_URL });
  return detectBlock(retry);
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
    return await withSharedVendorPage("coupang", async (page) => {
      const block = await gotoProductPage(page, url);
      if (block) {
        console.warn(`[coupang] 403 차단(${block}): ${url}`);
        return failedResult(url, BLOCK_MESSAGES[block]);
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
