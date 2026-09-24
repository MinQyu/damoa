import { SearchResultItem, VendorPriceResult } from "@/lib/types";

/**
 * 비교 중인 상품과 실제 최저가를 한눈에 보여준다.
 * product는 검색 결과에서 찾은 값이라 검색어 없이 들어온 경우 null일 수 있다.
 */
export default function ProductSummary({
  product,
  lowestPrice,
  isDone,
}: {
  product: SearchResultItem | null;
  lowestPrice: VendorPriceResult | null;
  isDone: boolean;
}) {
  return (
    <section className="flex gap-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      {product && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl ?? "/no-image.svg"}
          alt={product.title}
          className="h-20 w-20 shrink-0 rounded-lg bg-neutral-50 object-contain dark:bg-neutral-900 sm:h-24 sm:w-24"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="line-clamp-2 text-base font-bold sm:text-lg">
          {product?.title ?? "판매처별 실구매가 비교"}
        </h1>
        {product?.danawaPrice && (
          <p className="text-xs text-neutral-500">다나와 표시가 {product.danawaPrice.toLocaleString()}원~</p>
        )}
        <div className="mt-auto pt-1">
          {lowestPrice?.finalPrice ? (
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="text-neutral-500">최저 실구매가</span>
              <span className="text-lg font-bold">{lowestPrice.finalPrice.toLocaleString()}원</span>
              <span className="text-neutral-500">{lowestPrice.vendorName}</span>
            </p>
          ) : (
            <p className="text-sm text-neutral-500">
              {isDone ? "구매 가능한 판매처를 찾지 못했습니다." : "판매처별 실구매가를 확인하고 있습니다..."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
