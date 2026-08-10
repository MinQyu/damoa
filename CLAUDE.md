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

각 벤더는 공통 `VendorAdapter` 타입(`lib/vendors/types.ts`)을 구현하는 자체 파일(`coupang.ts`, `gmarket.ts`, `auction.ts`, `elevenst.ts`)을 가진다: `(url: string) => Promise<VendorPriceResult>`. 이들은 `lib/vendors/index.ts#VENDOR_ADAPTERS`에 등록된다. 벤더를 새로 추가하려면: `lib/types.ts`에 `VendorKey`를 추가하고, 라벨을 추가한 뒤, 어댑터 파일을 작성하고, `lib/vendors/index.ts`의 index map에 등록한다.

모든 어댑터는 각 사이트가 가격 데이터를 어떻게 구조화하든(예: 11번가는 `og:description` 메타 + 취소선 엘리먼트를 통해 `originalPrice`/`couponDiscount` 분리 정보를 노출하지만, 다른 사이트는 단일 가격만 노출할 수 있음) 공통 `VendorPriceResult` 형태(`lib/types.ts`)로 정규화한다. `status`는 `success | failed | unavailable` 중 하나다 — `unavailable`은 애초에 벤더 URL이 존재하지 않았음을, `failed`는 fetch/parse 시도 자체가 깨졌음을 의미한다.

**쿠팡/G마켓/옥션 봇 탐지 우회 (`lib/browserSession.ts`):** 일반 `fetch`와 puppeteer가 직접 `launch()`한 headless 브라우저 요청은 모두 봇 탐지에 걸려 403이 반환된다. 대신 사용자 백그라운드에 실제(headless가 아닌) Chrome을 `--remote-debugging-port`로 띄워두고 `puppeteer.connect()`로 CDP 연결해 접근하면 통과된다(2026-08 검증). `getBrowser()`/`withVendorPage()`가 이 연결을 관리한다 — 필요 시 Chrome을 자동으로 새로 띄우고, 화면 밖(`--window-position`)에 배치해 사용자 작업을 방해하지 않으며, Next.js 서버와 분리(detached)되어 서버 재시작 후에도 살아있는다(콜드 스타트로 인한 반복적인 봇 확인 페이지를 줄이기 위함). `coupang.ts`/`gmarket.ts`/`auction.ts`는 이 세션 위에서 `page.$eval`로 실제 렌더링된 DOM에서 가격을 추출한다. G마켓은 첫 진입 시 "봇 확인 중" 인터스티셜이 뜰 수 있어 `waitForRealPage()`로 통과를 기다린 뒤 파싱한다. 이 우회는 시점/IP/세션에 따라 다시 막힐 수 있으므로 상시 보장되는 것은 아니다 — 벤더 스크래핑이 다시 깨진다면 셀렉터뿐 아니라 이 봇 탐지 우회 자체가 막혔을 가능성도 함께 확인해야 한다.

### 캐싱 (`lib/cache.ts`)

단순한 `TTLCache<T>`(Map + 만료 타임스탬프, 외부 저장소 없음). 세 개의 인스턴스가 `globalThis`에 저장된다(Next.js 개발 모드의 HMR 모듈 재평가에도 살아남기 위함): `searchCache`(5분), `vendorUrlCache`(30분), `vendorPriceCache`(5분, `status === "success"`일 때만 채워짐). 이는 프로세스 로컬 캐시이므로 서버리스 인스턴스 간 상태를 공유하지 않으며 재시작 시 사라진다. `README.md`에는 다음 단계로 Redis로 옮기는 방안이 언급되어 있다.

### HTTP 레이어 (`lib/http.ts`)

`fetchHtml`은 브라우저와 유사한 `User-Agent`/`Accept-Language`, 10초 abort 타임아웃을 추가하여 `fetch`를 감싸고, 2xx가 아닌 응답에는 (status를 담은) `HttpError`를 던진다. `parseWonAmount`는 임의의 가격 텍스트에서 콤마를 제거하고 첫 번째 숫자 뭉치를 취해 원화 정수를 추출한다. 벤더 어댑터는 직접 `fetch`를 호출하는 대신 이 함수들에 의존한다.

### 프론트엔드

- `app/page.tsx` — 검색 페이지, 클라이언트 컴포넌트, 원본 쿼리 문자열을 키로 사용하는(디바운스 없는) `useQuery`이며 쿼리가 비어있지 않을 때만 활성화된다.
- `app/products/[id]/page.tsx` — 가격 비교 페이지, 마운트 시 `/api/products/[id]/prices`를 호출한다.
- `components/QueryProvider.tsx` — 앱을 `QueryClientProvider`(5분 `staleTime`, retry: 1)와 React Query Devtools로 감싸며, `app/layout.tsx`에 마운트되어 있다.
- 경로 별칭 `@/*` → `src/*` (`tsconfig.json` 참고).

### 새 벤더 엔드투엔드로 추가하기

1. `lib/types.ts`의 `VendorKey`와 `VENDOR_LABELS`에 벤더를 추가한다.
2. `lib/danawa.ts`의 `VENDOR_ALT_MAP`(다나와 상세 페이지에서 해당 벤더 블록을 식별하는 데 사용)에 다나와 `alt` 텍스트 매핑을 추가하고, `fetchVendorUrls`에 URL 구성 분기를 추가한다.
3. `VendorAdapter`를 구현하는 `lib/vendors/<vendor>.ts`를 작성하여 공통 `VendorPriceResult` 형태를 반환하게 한다.
4. `lib/vendors/index.ts`의 `VENDOR_ADAPTERS`(및 라벨 map)에 어댑터를 등록한다.

## 커밋 메시지 컨벤션

이 저장소의 커밋 메시지를 작성할 때(사용자가 커밋을 요청한 경우) 아래 형식을 따른다.

**제목 (첫 줄)**
- `type: 설명` 형식으로 쓴다. type은 아래 목록 중 변경의 성격에 가장 맞는 것을 고른다.
- 설명은 한국어, **명사형으로 종결**한다 (예: "...구현", "...작성", "...수정", "...추가", "...제거", "...정리"). 평서문("...했습니다", "...합니다")으로 끝내지 않는다.
- 마침표를 붙이지 않는다.
- 무엇을 변경했는지 하나의 요약으로 표현한다. 여러 성격의 변경을 억지로 한 줄에 욱여넣지 않는다 — type이 여러 개 필요하다면 커밋을 나누는 것을 고려한다.

**type 목록**
- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `refactor`: 동작 변화 없는 코드 구조 개선
- `docs`: 문서(`README.md`, `CLAUDE.md`, `CONVENTIONS.md`, `overview.md` 등)만 변경
- `style`: 포맷팅 등 코드 의미에 영향 없는 변경
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정/의존성 등 그 외 잡무성 변경

**본문 (변경 사항이 여러 갈래일 때만 작성)**
- 빈 줄로 제목과 구분한다.
- `-`로 시작하는 불릿 리스트로 나열하고, 각 항목도 명사형으로 종결한다.
- 코드만 봐서는 드러나지 않는 "왜"가 있다면 본문에 적는다. "무엇을 했는지"는 diff로 알 수 있으므로 되풀이하지 않는다.

**예시**:
```
docs: CLAUDE.md를 한국어로 작성
```
```
feat: Damoa 실구매가 비교 서비스 초기 구현

- 다나와 검색 및 오픈마켓(쿠팡/G마켓/옥션/11번가) 판매처 URL 추출
- 11번가 실구매가(쿠폰 할인 반영) 크롤링
- 쿠팡/G마켓/옥션은 봇 차단으로 조회 실패를 정상적으로 반환 (Promise.allSettled 기반 병렬 조회)
- 검색/판매처URL/가격 결과 메모리 TTL 캐시
- 검색 → 가격 비교 페이지 UI (Next.js App Router + Tailwind + React Query)
```

커밋을 생성할 때는 이 형식에 맞춰 제목(및 필요하면 본문)을 자동으로 작성한다. 그 외 커밋 생성 절차(Co-Authored-By 트레일러 포함 여부 등)는 시스템 지침을 따른다.
