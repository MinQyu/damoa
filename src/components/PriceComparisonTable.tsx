import { ProductPriceComparison, VendorPriceResult } from "@/lib/types";

function StatusBadge({ status }: { status: VendorPriceResult["status"] }) {
  if (status === "success") {
    return <span className="text-green-600">✓ 확인됨</span>;
  }
  if (status === "pending") {
    return <span className="animate-pulse text-neutral-400">● 가격 확인 중...</span>;
  }
  if (status === "unavailable") {
    return <span className="text-neutral-400">– 판매처 없음</span>;
  }
  return <span className="text-red-500">✕ 조회 실패</span>;
}

function formatDiscountType(r: VendorPriceResult) {
  if (r.discountType === "card") return `카드할인 (${r.cardName})`;
  if (r.discountType === "payment") return "결제수단 할인";
  if (r.discountType === "coupon") return "쿠폰할인";
  return "-";
}

export default function PriceComparisonTable({ data }: { data: ProductPriceComparison }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-3 font-medium">판매처</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 font-medium">표시가</th>
            <th className="px-4 py-3 font-medium">할인액</th>
            <th className="px-4 py-3 font-medium">할인 종류</th>
            <th className="px-4 py-3 font-medium">실구매가</th>
            <th className="px-4 py-3 font-medium">이동</th>
          </tr>
        </thead>
        <tbody>
          {data.results.map((r) => {
            const isLowest = data.lowestPrice?.vendor === r.vendor && r.status === "success";
            return (
              <tr
                key={r.vendor}
                className={`border-t border-neutral-200 dark:border-neutral-800 ${
                  isLowest ? "bg-amber-50 dark:bg-amber-950/30" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium">
                  {r.vendorName}
                  {isLowest && <span className="ml-1 text-xs text-amber-600">최저가</span>}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                  {r.error && <p className="text-xs text-neutral-400">{r.error}</p>}
                </td>
                <td className="px-4 py-3">
                  {r.originalPrice ? `${r.originalPrice.toLocaleString()}원` : "-"}
                </td>
                <td className="px-4 py-3">
                  {r.couponDiscount ? `-${r.couponDiscount.toLocaleString()}원` : "-"}
                </td>
                <td className="px-4 py-3">{formatDiscountType(r)}</td>
                <td className="px-4 py-3 font-semibold">
                  {r.finalPrice ? `${r.finalPrice.toLocaleString()}원` : "-"}
                </td>
                <td className="px-4 py-3">
                  {r.productUrl ? (
                    <a
                      href={r.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      바로가기 →
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
