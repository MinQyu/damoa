# 🛒 Damoa (다모아)

다나와 검색 결과를 기반으로 각 오픈마켓의 쿠폰 할인이 반영된 **실구매가**를 조회하여, 실제 최저가와 직접 구매 링크를 제공하는 가격 비교 서비스입니다.

자세한 기획 배경과 목표는 [`overview.md`](./overview.md)를 참고하세요.

이 저장소는 [Find-The-Real-Price](https://github.com/MinQyu/Find-The-Real-Price) 프로젝트를 이어받아 아키텍처를 재설계한 버전입니다.

## 기술 스택

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Tanstack React Query (클라이언트 데이터 패칭/캐싱)
- cheerio (HTML 파싱)
- puppeteer (백그라운드 Chrome에 CDP로 연결해 쿠팡/G마켓/옥션 봇 탐지 우회)

## 프로젝트 구조

```
src/
  app/
    page.tsx                       검색 페이지
    products/[id]/page.tsx         가격 비교 페이지
    api/
      search/route.ts              다나와 검색 크롤링
      products/[id]/urls/route.ts  다나와 → 오픈마켓 판매처 URL 추출
      products/[id]/prices/route.ts 오픈마켓별 실구매가 조회 (병렬)
      products/[id]/prices/stream/route.ts 실구매가 조회 SSE 스트리밍
  components/                      UI 컴포넌트
  lib/
    danawa.ts                      다나와 검색/URL 추출 로직
    vendors/                       오픈마켓별 가격 크롤러 어댑터
    browserSession.ts              백그라운드 Chrome CDP 연결 관리 (봇 탐지 우회)
    cache.ts                       메모리 TTL 캐시
    http.ts, types.ts
```

## 실행 방법

```bash
npm install
npm run dev
```

## 구현 현황 (2026-08 기준)

| 기능 | 상태 |
| --- | --- |
| 다나와 상품 검색 | ✅ 동작 |
| 다나와 → 오픈마켓(쿠팡/G마켓/옥션/11번가) 판매처 링크 추출 | ✅ 동작 |
| 11번가 실구매가(쿠폰 할인 반영) 조회 | ✅ 동작 |
| 쿠팡 / G마켓 / 옥션 실구매가 조회 | ✅ 동작. 서버 요청·헤드리스 브라우저(puppeteer) 요청은 여전히 403(Access Denied)으로 차단되지만, 사용자 백그라운드의 실제(headless 아닌) Chrome에 CDP로 연결해 접근하면 통과됨을 확인 (`src/lib/browserSession.ts`, `src/lib/vendors/coupang.ts`, `gmarket.ts`, `auction.ts` 참고). 이 우회는 상시 보장되는 것은 아니며 시점/IP/세션에 따라 다시 막힐 수 있음 |

가격 조회는 병렬 실행되며, 일부 판매처 조회가 실패해도 나머지 결과는 정상적으로 반환됩니다. `GET /api/products/[id]/prices/stream`은 이 조회 과정을 Server-Sent Events로 스트리밍하여, 벤더 하나가 끝날 때마다(`vendor` 이벤트) 그 결과를 바로 프론트엔드에 반영하고 전체가 끝나면(`done` 이벤트) 최저가를 포함한 전체 비교 결과를 보냅니다. 상품 상세 페이지는 이 스트림을 구독해 판매처별 조회 상태(가격 확인 중 → 확인됨/조회 실패/판매처 없음)를 실시간으로 보여줍니다. 기존 `GET /api/products/[id]/prices`(한 번에 전체 결과 반환)도 별도 소비처를 위해 계속 유지됩니다.

### 다음 단계로 시도해볼 것

- 쿠팡/G마켓/옥션 봇 탐지 우회가 다시 막힐 경우를 대비해 프록시 또는 공식 오픈 API(쿠팡 파트너스 등) 검토
- 검색/가격 결과 캐시를 Redis 등 외부 저장소로 전환
