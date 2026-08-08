import * as cheerio from "cheerio";
import { fetchHtml } from "./http";
import { SearchResultItem, VendorKey, VendorUrls } from "./types";

const SEARCH_ITEM_SELECTOR = ".product_list .prod_main_info";
const IMG_SELECTOR = ".thumb_image img";
const NAME_SELECTOR = ".prod_info .prod_name a";
const SPEC_SELECTOR = ".prod_info .spec_list";

export async function searchDanawa(query: string): Promise<SearchResultItem[]> {
  const url = `https://search.danawa.com/dsearch.php?module=goods&act=dispMain&k1=${encodeURIComponent(
    query
  )}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const results: SearchResultItem[] = [];

  $(SEARCH_ITEM_SELECTOR).each((_, el) => {
    const item = $(el);
    const link = item.find(NAME_SELECTOR).attr("href") ?? "";
    const pcodeMatch = link.match(/pcode=(\d+)/);
    if (!pcodeMatch) return;
    const id = parseInt(pcodeMatch[1], 10);

    const title = item.find(NAME_SELECTOR).text().trim();
    if (!title) return;

    const imageUrl =
      item.find(IMG_SELECTOR).attr("data-src") ??
      item.find(IMG_SELECTOR).attr("src") ??
      null;

    const specSummary = item
      .find(SPEC_SELECTOR)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const priceValue = $(`#min_price_${id}`).attr("value");
    const danawaPrice = priceValue ? parseInt(priceValue, 10) : null;

    results.push({
      id,
      title,
      imageUrl,
      specSummary,
      danawaPrice,
      danawaUrl: `https://prod.danawa.com/info/?pcode=${id}`,
    });
  });

  return results;
}

const VENDOR_ALT_MAP: Record<string, VendorKey> = {
  쿠팡: "coupang",
  G마켓: "gmarket",
  옥션: "auction",
  "11번가": "elevenst",
};

async function resolveCoupangProductUrl(bridgeUrl: string): Promise<string | null> {
  try {
    const html = await fetchHtml(bridgeUrl);
    const match = html.match(/pageKey=(\d+)/);
    if (!match) return null;
    return `https://www.coupang.com/vp/products/${match[1]}`;
  } catch {
    return null;
  }
}

/**
 * 다나와 상품 상세 페이지에서 오픈마켓별 판매처 링크(link_pcode)를 추출한다.
 * 쿠팡은 브릿지 페이지를 한 번 더 거쳐야 최종 상품 URL의 pageKey를 얻을 수 있다.
 */
export async function fetchVendorUrls(productId: number): Promise<VendorUrls> {
  const url = `https://prod.danawa.com/info/?pcode=${productId}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const bridgeUrls: Partial<Record<VendorKey, string>> = {};
  $("li.list-item").each((_, el) => {
    const item = $(el);
    const alt = item.find(".box__logo img").attr("alt")?.trim();
    const href = item.find("a.link__full-cover").attr("href");
    if (!alt || !href) return;
    const vendor = VENDOR_ALT_MAP[alt];
    if (!vendor || bridgeUrls[vendor]) return;
    bridgeUrls[vendor] = href;
  });

  const result: VendorUrls = {
    coupang: null,
    gmarket: null,
    auction: null,
    elevenst: null,
  };

  const extractLinkPcode = (href: string): string | null => {
    const match = href.match(/link_pcode=([^&]+)/);
    return match ? match[1] : null;
  };

  if (bridgeUrls.coupang) {
    result.coupang = await resolveCoupangProductUrl(bridgeUrls.coupang);
  }
  if (bridgeUrls.gmarket) {
    const pcode = extractLinkPcode(bridgeUrls.gmarket);
    result.gmarket = pcode ? `https://item.gmarket.co.kr/Item?goodscode=${pcode}` : null;
  }
  if (bridgeUrls.auction) {
    const pcode = extractLinkPcode(bridgeUrls.auction);
    result.auction = pcode
      ? `https://itempage3.auction.co.kr/DetailView.aspx?itemno=${pcode}`
      : null;
  }
  if (bridgeUrls.elevenst) {
    const pcode = extractLinkPcode(bridgeUrls.elevenst);
    result.elevenst = pcode ? `https://www.11st.co.kr/products/${pcode}` : null;
  }

  return result;
}
