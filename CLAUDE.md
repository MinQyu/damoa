# CLAUDE.md

이 파일은 이 저장소에서 작업할 때 Claude Code(claude.ai/code)가 참고해야 할 가이드를 제공한다.

## 이 프로젝트는 무엇인가

다모아(Damoa)는 최저가 비교 서비스다. 다나와(Danawa) 검색 결과를 스크래핑하고, 검색 결과에 나열된 각 오픈마켓(쿠팡, 지마켓, 옥션, 11번가)의 판매처 링크를 따라가서 각 벤더의 실제 상품 페이지에서 **진짜** 구매 가능한 가격을 다시 확인한다. 쿠폰 할인 때문에 다나와에 표시된 가격과 실제 결제 가격이 다른 경우가 많기 때문이다. 이 서비스의 목표는 다나와의 리퍼럴 링크를 거치지 않고, 실제 최저가와 바로 구매할 수 있는 직접 링크를 보여주는 것이다. 전체 제품 스펙(한국어)은 `overview.md`를, 간단한 현황 요약은 `README.md`를 참고하라.

이 저장소는 https://github.com/MinQyu/Find-The-Real-Price 를 재설계하여 이어가는 프로젝트다.

## 명령어

```bash
npm run dev     # 개발 서버 실행 (http://localhost:3000)
npm run build   # 프로덕션 빌드
npm run start   # 프로덕션 빌드 실행
npm run lint    # next lint (eslint-config-next: core-web-vitals + typescript)
```

이 저장소에는 구성된 테스트 스위트가 없다.

## 아키텍처

Next.js 14 App Router + TypeScript, Tailwind CSS, 클라이언트 데이터 페칭용 Tanstack React Query 사용. 데이터베이스는 없으며 — 모든 데이터는 실시간으로 스크래핑되어 인메모리 TTL 캐시에 보관된다.

### 요청 흐름

1. **검색** (`/` → `GET /api/search?q=`) — `lib/danawa.ts#searchDanawa`가 cheerio로 `search.danawa.com`을 스크래핑하여 `SearchResultItem[]`을 반환한다 (id는 다나와의 `pcode`).
2. **벤더 URL 확인** (`GET /api/products/[id]/urls`) — `lib/danawa.ts#fetchVendorUrls`가 다나와 상품 상세 페이지(`prod.danawa.com/info/?pcode=`)를 로드하여 "구매하기" 판매처 목록에서 각 오픈마켓의 `link_pcode`를 추출한다. 쿠팡은 브리지 URL을 한 번 더 거쳐 `pageKey`를 실제 상품 URL로 변환해야 한다(`resolveCoupangProductUrl`). 이 라우트는 대부분 `/prices`에서 대체되었는데, 이 라우트가 내부적으로 동일한 URL 확인 작업을 수행하기 때문이다.
3. **가격 비교** (`/products/[id]` → `GET /api/products/[id]/prices`) — (캐시된) 벤더 URL을 확인한 뒤 `lib/vendors#fetchAllVendorPrices`를 호출한다. 이 함수는 **`Promise.allSettled`로 모든 벤더 어댑터를 병렬 실행**하여 한 벤더가 실패하거나 타임아웃되어도 다른 벤더를 막지 않도록 한다. 결과는 `status === "success"`인 항목들 중 `finalPrice`가 가장 낮은 `lowestPrice`로 집계된다.

### 벤더 어댑터 (`lib/vendors/`)

각 벤더는 공통 `VendorAdapter` 타입(`lib/vendors/types.ts`)을 구현하는 자체 파일(`coupang.ts`, `gmarket.ts`, `auction.ts`, `elevenst.ts`)을 가진다: `(url: string) => Promise<VendorPriceResult>`. 이들은 `lib/vendors/index.ts#VENDOR_ADAPTERS`에 등록된다. 새 벤더를 엔드투엔드로 추가하는 절차는 `add-vendor` 스킬을 참고한다.

모든 어댑터는 각 사이트가 가격 데이터를 어떻게 구조화하든(예: 11번가는 `og:description` 메타 + 취소선 엘리먼트를 통해 `originalPrice`/`couponDiscount` 분리 정보를 노출하지만, 다른 사이트는 단일 가격만 노출할 수 있음) 공통 `VendorPriceResult` 형태(`lib/types.ts`)로 정규화한다. `status`는 `success | failed | unavailable` 중 하나다 — `unavailable`은 애초에 벤더 URL이 존재하지 않았음을, `failed`는 fetch/parse 시도 자체가 깨졌음을 의미한다.

쿠팡/G마켓/옥션은 일반 `fetch`나 headless 브라우저로 접근하면 봇 탐지에 걸려 403이 반환되므로, `lib/browserSession.ts`가 사용자 백그라운드의 실제 Chrome에 CDP로 연결해 우회한다. 이 메커니즘과 트러블슈팅은 `vendor-bot-bypass` 스킬을 참고한다.

### 캐싱 (`lib/cache.ts`)

단순한 `TTLCache<T>`(Map + 만료 타임스탬프, 외부 저장소 없음). 세 개의 인스턴스가 `globalThis`에 저장된다(Next.js 개발 모드의 HMR 모듈 재평가에도 살아남기 위함): `searchCache`(5분), `vendorUrlCache`(30분), `vendorPriceCache`(5분, `status === "success"`일 때만 채워짐). 이는 프로세스 로컬 캐시이므로 서버리스 인스턴스 간 상태를 공유하지 않으며 재시작 시 사라진다. `README.md`에는 다음 단계로 Redis로 옮기는 방안이 언급되어 있다.

### HTTP 레이어 (`lib/http.ts`)

`fetchHtml`은 브라우저와 유사한 `User-Agent`/`Accept-Language`, 10초 abort 타임아웃을 추가하여 `fetch`를 감싸고, 2xx가 아닌 응답에는 (status를 담은) `HttpError`를 던진다. `parseWonAmount`는 임의의 가격 텍스트에서 콤마를 제거하고 첫 번째 숫자 뭉치를 취해 원화 정수를 추출한다. 벤더 어댑터는 직접 `fetch`를 호출하는 대신 이 함수들에 의존한다.

### 프론트엔드

- `app/page.tsx` — 검색 페이지, 클라이언트 컴포넌트, 원본 쿼리 문자열을 키로 사용하는(디바운스 없는) `useQuery`이며 쿼리가 비어있지 않을 때만 활성화된다.
- `app/products/[id]/page.tsx` — 가격 비교 페이지, 마운트 시 `/api/products/[id]/prices`를 호출한다.
- `components/QueryProvider.tsx` — 앱을 `QueryClientProvider`(5분 `staleTime`, retry: 1)와 React Query Devtools로 감싸며, `app/layout.tsx`에 마운트되어 있다.
- 경로 별칭 `@/*` → `src/*` (`tsconfig.json` 참고).

## 커밋 메시지 컨벤션

커밋 메시지를 작성할 때(사용자가 커밋을 요청한 경우)는 `commit-message` 스킬을 참고한다.
