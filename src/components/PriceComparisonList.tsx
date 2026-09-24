import { ConditionalDiscount, VendorPriceResult, VendorPriceStatus } from "@/lib/types";

const STATUS_ORDER: Record<VendorPriceStatus, number> = {
  success: 0,
  pending: 1,
  failed: 2,
  unavailable: 3,
};

/**
 * 조회가 끝난 판매처를 실구매가가 싼 순서로 위에 두고, 확인 중·실패·판매처 없음은 그 아래로 보낸다.
 * 같은 상태끼리는 원래 벤더 순서를 유지해 스트리밍 중 카드가 불필요하게 뒤섞이지 않게 한다.
 */
export function sortVendorResults(results: VendorPriceResult[]): VendorPriceResult[] {
  return results
    .map((result, index) => ({ result, index }))
    .sort((a, b) => {
      const statusGap = STATUS_ORDER[a.result.status] - STATUS_ORDER[b.result.status];
      if (statusGap !== 0) return statusGap;
      if (a.result.status === "success") {
        const priceGap = (a.result.finalPrice ?? Infinity) - (b.result.finalPrice ?? Infinity);
        if (priceGap !== 0) return priceGap;
      }
      return a.index - b.index;
    })
    .map(({ result }) => result);
}

function formatWon(amount: number) {
  return `${amount.toLocaleString()}원`;
}

function formatCondition(discount: ConditionalDiscount) {
  if (discount.type === "card") return discount.cardName ? `${discount.cardName} 결제 시` : "카드 즉시할인 시";
  return "특정 결제수단 이용 시";
}

/** 실구매가가 어떻게 계산됐는지(상품가 − 할인 + 배송비)를 한 줄로 보여준다. */
function PriceBreakdown({ result }: { result: VendorPriceResult }) {
  const parts: React.ReactNode[] = [];
  if (result.originalPrice !== null) parts.push(<span key="original">상품가 {formatWon(result.originalPrice)}</span>);
  if (result.couponDiscount) {
    parts.push(
      <span key="discount" className="text-emerald-600 dark:text-emerald-400">
        − 할인 {formatWon(result.couponDiscount)}
      </span>
    );
  }
  if (result.shippingFee === null) {
    parts.push(
      <span key="shipping" className="text-amber-600 dark:text-amber-400">
        + 배송비 확인 불가
      </span>
    );
  } else if (result.shippingFee === 0) {
    parts.push(<span key="shipping">+ 무료배송</span>);
  } else {
    parts.push(<span key="shipping">+ 배송비 {formatWon(result.shippingFee)}</span>);
  }
  return <p className="flex flex-wrap gap-x-1.5 text-xs text-neutral-500">{parts}</p>;
}

function VendorLink({ result, label }: { result: VendorPriceResult; label: string }) {
  if (!result.productUrl) return null;
  return (
    <a
      href={result.productUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
    >
      {label}
    </a>
  );
}

function SuccessCard({ result, isLowest }: { result: VendorPriceResult; isLowest: boolean }) {
  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        isLowest
          ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{result.vendorName}</span>
          {isLowest && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">최저가</span>
          )}
        </div>
        <p className="text-xl font-bold">{result.finalPrice !== null ? formatWon(result.finalPrice) : "-"}</p>
        <PriceBreakdown result={result} />
        {result.conditionalDiscount && (
          <p className="text-xs text-sky-700 dark:text-sky-300">
            {formatCondition(result.conditionalDiscount)} {formatWon(result.conditionalDiscount.price)}
          </p>
        )}
      </div>
      <VendorLink result={result} label="판매 페이지 →" />
    </li>
  );
}

function PendingCard({ result }: { result: VendorPriceResult }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <span className="font-medium">{result.vendorName}</span>
        <span className="animate-pulse text-xs text-neutral-400">가격 확인 중...</span>
      </div>
      <div className="h-6 w-32 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
      <div className="h-3 w-48 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
    </li>
  );
}

function FailedCard({ result }: { result: VendorPriceResult }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{result.vendorName}</span>
        <p className="text-sm text-red-500">가격 확인 실패</p>
        {result.error && <p className="text-xs text-neutral-400">{result.error}</p>}
      </div>
      <VendorLink result={result} label="직접 확인하기 →" />
    </li>
  );
}

function UnavailableCard({ result }: { result: VendorPriceResult }) {
  return (
    <li className="flex items-center justify-between rounded-2xl border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-400 dark:border-neutral-800">
      <span>{result.vendorName}</span>
      <span className="text-xs">판매처 없음</span>
    </li>
  );
}

function ConditionalNotice({ result, lowestPrice }: { result: VendorPriceResult; lowestPrice: VendorPriceResult | null }) {
  const discount = result.conditionalDiscount;
  if (!discount) return null;
  return (
    <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
      {formatCondition(discount)} {result.vendorName}에서{" "}
      <span className="font-semibold">{formatWon(discount.price)}</span>에 구매할 수 있습니다
      {lowestPrice?.finalPrice
        ? ` (누구나 받을 수 있는 최저가보다 ${formatWon(lowestPrice.finalPrice - discount.price)} 저렴)`
        : ""}
      .
    </p>
  );
}

export default function PriceComparisonList({
  results,
  lowestPrice,
  lowestConditionalPrice,
}: {
  results: VendorPriceResult[];
  lowestPrice: VendorPriceResult | null;
  lowestConditionalPrice: VendorPriceResult | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {lowestConditionalPrice && <ConditionalNotice result={lowestConditionalPrice} lowestPrice={lowestPrice} />}
      <ul className="flex flex-col gap-3">
        {sortVendorResults(results).map((result) => {
          if (result.status === "success") {
            // 같은 실구매가인 판매처가 여럿이면 모두 최저가로 표시한다.
            const isLowest = lowestPrice?.finalPrice != null && result.finalPrice === lowestPrice.finalPrice;
            return <SuccessCard key={result.vendor} result={result} isLowest={isLowest} />;
          }
          if (result.status === "pending") return <PendingCard key={result.vendor} result={result} />;
          if (result.status === "failed") return <FailedCard key={result.vendor} result={result} />;
          return <UnavailableCard key={result.vendor} result={result} />;
        })}
      </ul>
      <p className="text-xs leading-relaxed text-neutral-500">
        실구매가는 상품가에서 누구나 받을 수 있는 할인을 빼고 배송비를 더한 가격입니다. 카드사·결제수단 할인처럼
        사용자마다 적용 여부가 다른 할인은 파란 글씨로 따로 표시합니다.
      </p>
    </div>
  );
}
