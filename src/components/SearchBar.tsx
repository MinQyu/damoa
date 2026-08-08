"use client";

import { useState } from "react";

export default function SearchBar({
  onSearch,
  initialQuery = "",
}: {
  onSearch: (query: string) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="상품명을 검색해보세요 (예: LG 그램 16)"
        className="flex-1 rounded-lg border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        검색
      </button>
    </form>
  );
}
