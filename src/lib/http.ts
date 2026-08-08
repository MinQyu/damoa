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
