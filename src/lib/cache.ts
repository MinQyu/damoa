interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

const globalForCache = globalThis as unknown as {
  __damoaSearchCache?: TTLCache<unknown>;
  __damoaVendorUrlCache?: TTLCache<unknown>;
  __damoaVendorPriceCache?: TTLCache<unknown>;
};

// Next.js dev 모드 HMR로 모듈이 재평가되어도 캐시가 유지되도록 globalThis에 보관한다.
export const searchCache: TTLCache<import("./types").SearchResultItem[]> =
  (globalForCache.__damoaSearchCache as never) ??
  (globalForCache.__damoaSearchCache = new TTLCache(5 * 60 * 1000) as never);

export const vendorUrlCache: TTLCache<import("./types").VendorUrls> =
  (globalForCache.__damoaVendorUrlCache as never) ??
  (globalForCache.__damoaVendorUrlCache = new TTLCache(30 * 60 * 1000) as never);

export const vendorPriceCache: TTLCache<import("./types").VendorPriceResult> =
  (globalForCache.__damoaVendorPriceCache as never) ??
  (globalForCache.__damoaVendorPriceCache = new TTLCache(5 * 60 * 1000) as never);
