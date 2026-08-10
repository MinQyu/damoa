"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";
import { SearchResultItem } from "@/lib/types";

async function fetchSearchResults(query: string): Promise<SearchResultItem[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("검색에 실패했습니다.");
  return res.json();
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchSearchResults(query),
    enabled: query.length > 0,
  });

  const handleSearch = (next: string) => {
    router.push(`/?q=${encodeURIComponent(next)}`);
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">🛒 Damoa</h1>
        <p className="text-sm text-neutral-500">
          다나와 표시가가 아닌, 지금 실제로 구매 가능한 최저가를 찾아드려요.
        </p>
      </div>

      <SearchBar key={query} onSearch={handleSearch} initialQuery={query} />

      {isLoading && <p className="text-center text-sm text-neutral-500">검색 중...</p>}
      {isError && (
        <p className="text-center text-sm text-red-500">
          {error instanceof Error ? error.message : "오류가 발생했습니다."}
        </p>
      )}
      {data && data.length === 0 && (
        <p className="text-center text-sm text-neutral-500">검색 결과가 없습니다.</p>
      )}

      <div className="flex flex-col gap-3">
        {data?.map((item) => (
          <ProductCard key={item.id} item={item} query={query} />
        ))}
      </div>
    </main>
  );
}
