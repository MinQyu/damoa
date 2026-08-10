"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PriceComparisonTable from "@/components/PriceComparisonTable";
import { ProductPriceComparison } from "@/lib/types";

async function fetchPriceComparison(id: string): Promise<ProductPriceComparison> {
  const res = await fetch(`/api/products/${id}/prices`);
  if (!res.ok) throw new Error("가격 비교 정보를 가져오지 못했습니다.");
  return res.json();
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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["priceComparison", id],
    queryFn: () => fetchPriceComparison(id),
  });

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

      {isLoading && (
        <p className="text-center text-sm text-neutral-500">
          판매처별 가격을 조회하는 중입니다...
        </p>
      )}
      {isError && (
        <p className="text-center text-sm text-red-500">
          {error instanceof Error ? error.message : "오류가 발생했습니다."}
        </p>
      )}
      {data && <PriceComparisonTable data={data} />}
    </main>
  );
}
