const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchHtml(
  url: string,
  init?: RequestInit,
  timeoutMs = 10000
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...DEFAULT_HEADERS, ...(init?.headers ?? {}) },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new HttpError(`요청 실패: ${res.status} ${url}`, res.status);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function parseWonAmount(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/(\d+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

const SHIPPING_FEE_PATTERN = /배송비\s*([\d,]+)\s*원/;

/**
 * 배송 안내 문구에서 기본 배송비를 뽑는다. "무료배송"이 있으면 0, "배송비 3,100원"처럼
 * 금액이 붙어 있으면 그 금액이다. "제주지역 5,000원" 같은 지역별 추가 배송비는 "배송비"
 * 바로 뒤에 붙지 않아 걸리지 않는다. 둘 다 없으면 판단할 수 없어 null을 반환한다.
 */
export function parseShippingFee(text: string | null | undefined): number | null {
  if (!text) return null;
  if (text.includes("무료배송")) return 0;
  const match = text.match(SHIPPING_FEE_PATTERN);
  return match ? parseWonAmount(match[1]) : null;
}
