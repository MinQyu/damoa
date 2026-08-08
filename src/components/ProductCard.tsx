import Link from "next/link";
import { SearchResultItem } from "@/lib/types";

export default function ProductCard({ item }: { item: SearchResultItem }) {
  return (
    <Link
      href={`/products/${item.id}`}
      className="flex gap-4 rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-400 hover:shadow-sm dark:border-neutral-800"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl ?? "/no-image.svg"}
        alt={item.title}
        className="h-24 w-24 shrink-0 rounded-lg object-contain bg-neutral-50 dark:bg-neutral-900"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="line-clamp-2 text-sm font-medium">{item.title}</h3>
        <p className="line-clamp-2 text-xs text-neutral-500">{item.specSummary}</p>
        <p className="mt-auto text-sm font-semibold">
          {item.danawaPrice ? `${item.danawaPrice.toLocaleString()}원~` : "가격 정보 없음"}
        </p>
      </div>
    </Link>
  );
}
