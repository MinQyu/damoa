import { NextRequest } from "next/server";
import { fetchVendorUrls } from "@/lib/danawa";
import { streamVendorPrices } from "@/lib/vendors";
import { vendorUrlCache } from "@/lib/cache";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 판매처별 가격 조회 상태를 Server-Sent Events로 스트리밍한다.
 * 벤더 하나가 끝날 때마다 "vendor" 이벤트로, 전체가 끝나면 "done" 이벤트로 알린다
 * (overview.md 7절 "크롤링 상태 UX" 참고). JSON 한 번에 응답하는 /prices와 달리
 * 응답이 느린 벤더(쿠팡/G마켓/옥션 CDP 우회) 때문에 다른 벤더 결과까지 지연되지 않는다.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const productId = parseInt(params.id, 10);
  if (!productId) {
    return new Response(sseEvent("error", { message: "유효하지 않은 상품 ID입니다." }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const cacheKey = String(productId);
        const vendorUrls = vendorUrlCache.get(cacheKey) ?? (await fetchVendorUrls(productId));
        vendorUrlCache.set(cacheKey, vendorUrls);

        const comparison = await streamVendorPrices(productId, vendorUrls, (result) => {
          controller.enqueue(encoder.encode(sseEvent("vendor", result)));
        });

        controller.enqueue(encoder.encode(sseEvent("done", comparison)));
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            sseEvent("error", {
              message: error instanceof Error ? error.message : "가격 비교에 실패했습니다.",
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
