# 🛒 Damoa (다모아)

다나와 검색 결과를 기반으로 각 오픈마켓의 쿠폰 할인이 반영된 **실구매가**를 조회하여, 실제 최저가와 직접 구매 링크를 제공하는 가격 비교 서비스입니다.

자세한 기획 배경과 목표는 [`overview.md`](./overview.md)를 참고하세요.

이 저장소는 [Find-The-Real-Price](https://github.com/MinQyu/Find-The-Real-Price) 프로젝트를 이어받아 아키텍처를 재설계한 버전입니다.

## 기술 스택

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Tanstack React Query (클라이언트 데이터 패칭/캐싱)
- cheerio (HTML 파싱)

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
  components/                      UI 컴포넌트
  lib/
    danawa.ts                      다나와 검색/URL 추출 로직
    vendors/                       오픈마켓별 가격 크롤러 어댑터
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
| 쿠팡 / G마켓 / 옥션 실구매가 조회 | ⚠️ 서버 요청·헤드리스 브라우저(puppeteer) 요청 모두 403(Access Denied)으로 차단되는 것을 확인. 판매처 이동 링크 자체는 정상 제공되며, 가격 조회는 "조회 실패" 상태로 정상적으로 표시됨 (`src/lib/vendors/coupang.ts`, `gmarket.ts`, `auction.ts` 참고) |

가격 조회는 `Promise.allSettled` 기반으로 병렬 실행되며, 일부 판매처 조회가 실패해도 나머지 결과는 정상적으로 반환됩니다.

### 다음 단계로 시도해볼 것

- 쿠팡/G마켓/옥션 차단 우회: stealth 플러그인, 프록시, 또는 공식 오픈 API(쿠팡 파트너스 등) 검토
- 판매처별 조회 상태를 실시간(SSE)으로 스트리밍하는 UX 개선
- 검색/가격 결과 캐시를 Redis 등 외부 저장소로 전환
