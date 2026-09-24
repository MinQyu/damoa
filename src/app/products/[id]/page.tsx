"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PriceComparisonTable from "@/components/PriceComparisonTable";
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

  useEffect(() => {
    setResults(initialResults());
    setLowestPrice(null);
    setLowestConditionalPrice(null);
    setStreamError(null);

    const source = new EventSource(`/api/products/${id}/prices/stream`);

    source.addEventListener("vendor", (event) => {
      const result: VendorPriceResult = JSON.parse((event as MessageEvent).data);
      setResults((prev) => ({ ...prev, [result.vendor]: result }));
    });

    source.addEventListener("done", (event) => {
      const comparison: ProductPriceComparison = JSON.parse((event as MessageEvent).data);
      setLowestPrice(comparison.lowestPrice);
      setLowestConditionalPrice(comparison.lowestConditionalPrice);
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
      source.close();
    });

    return () => source.close();
  }, [id]);

  const data: ProductPriceComparison = {
    productId: Number(id),
    results: VENDOR_KEYS.map((vendor) => results[vendor]),
    lowestPrice,
    lowestConditionalPrice,
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16">
      <Link href={backHref} className="text-sm text-neutral-500 hover:underline">
        ← 검색 결과로 돌아가기
      </Link>

      <div>
        <h1 className="text-xl font-bold">판매처별 실구매가 비교</h1>
        <p className="mt-1 text-sm text-neutral-500">
          각 오픈마켓 상품 페이지를 실시간으로 확인해 쿠폰 할인이 반영된 가격을 비교합니다.
        </p>
      </div>

      {streamError && <p className="text-center text-sm text-red-500">{streamError}</p>}
      <PriceComparisonTable data={data} />
    </main>
  );
}
