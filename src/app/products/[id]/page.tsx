"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import PriceComparisonList from "@/components/PriceComparisonList";
import ProductSummary from "@/components/ProductSummary";
import { fetchSearchResults } from "@/lib/searchApi";
import { ProductPriceComparison, VENDOR_LABELS, VendorKey, VendorPriceResult } from "@/lib/types";

const VENDOR_KEYS = Object.keys(VENDOR_LABELS) as VendorKey[];

function pendingResult(vendor: VendorKey): VendorPriceResult {
  return {
    vendor,
    vendorName: VENDOR_LABELS[vendor],
    status: "pending",
    originalPrice: null,
    couponDiscount: null,
    discountType: "none",
    conditionalDiscount: null,
    shippingFee: null,
    finalPrice: null,
    productUrl: null,
  };
}

function initialResults(): Record<VendorKey, VendorPriceResult> {
  return Object.fromEntries(VENDOR_KEYS.map((vendor) => [vendor, pendingResult(vendor)])) as Record<
    VendorKey,
    VendorPriceResult
  >;
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <ProductDetailContent id={params.id} />
    </Suspense>
  );
}

function ProductDetailContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const query = searchParams.get("q");
  const backHref = query ? `/?q=${encodeURIComponent(query)}` : "/";

  const [results, setResults] = useState<Record<VendorKey, VendorPriceResult>>(initialResults);
  const [lowestPrice, setLowestPrice] = useState<VendorPriceResult | null>(null);
  const [lowestConditionalPrice, setLowestConditionalPrice] = useState<VendorPriceResult | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  // 상세 페이지는 상품 정보를 따로 조회하지 않고, 검색 페이지와 같은 쿼리 키로 검색 결과를
  // 재사용한다(검색에서 넘어온 경우 React Query 캐시에 이미 있다).
  const { data: searchResults } = useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchSearchResults(query ?? ""),
    enabled: Boolean(query),
  });
  const product = searchResults?.find((item) => item.id === Number(id)) ?? null;

  useEffect(() => {
    setResults(initialResults());
    setLowestPrice(null);
    setLowestConditionalPrice(null);
    setStreamError(null);
    setIsDone(false);

    const source = new EventSource(`/api/products/${id}/prices/stream`);

    source.addEventListener("vendor", (event) => {
      const result: VendorPriceResult = JSON.parse((event as MessageEvent).data);
      setResults((prev) => ({ ...prev, [result.vendor]: result }));
    });

    source.addEventListener("done", (event) => {
      const comparison: ProductPriceComparison = JSON.parse((event as MessageEvent).data);
      setLowestPrice(comparison.lowestPrice);
      setLowestConditionalPrice(comparison.lowestConditionalPrice);
      setIsDone(true);
      source.close();
    });

    source.addEventListener("error", (event) => {
      const messageEvent = event as MessageEvent;
      if (messageEvent.data) {
        const payload = JSON.parse(messageEvent.data);
        setStreamError(payload.message ?? "가격 비교에 실패했습니다.");
      } else {
        setStreamError("가격 비교 서버와의 연결이 끊어졌습니다.");
      }
      setIsDone(true);
      source.close();
    });

    return () => source.close();
  }, [id]);

  const resultList = VENDOR_KEYS.map((vendor) => results[vendor]);
  const checkedCount = resultList.filter((r) => r.status !== "pending").length;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10 sm:py-16">
      <Link href={backHref} className="text-sm text-neutral-500 hover:underline">
        ← 검색 결과로 돌아가기
      </Link>

      <ProductSummary product={product} lowestPrice={lowestPrice} isDone={isDone} />

      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">판매처별 실구매가</h2>
        <span className="text-xs text-neutral-500">
          {isDone ? "확인 완료" : `${VENDOR_KEYS.length}곳 중 ${checkedCount}곳 확인`}
        </span>
      </div>

      {streamError && <p className="text-center text-sm text-red-500">{streamError}</p>}
      <PriceComparisonList
        results={resultList}
        lowestPrice={lowestPrice}
        lowestConditionalPrice={lowestConditionalPrice}
      />
    </main>
  );
}
