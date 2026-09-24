import { SearchResultItem } from "./types";

export async function fetchSearchResults(query: string): Promise<SearchResultItem[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("검색에 실패했습니다.");
  return res.json();
}
