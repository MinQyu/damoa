# 코딩 컨벤션

이 문서는 다모아(Damoa) 저장소에서 코드를 작성할 때 따르는 규칙을 정리한다. 새로운 규칙이 필요하면 이 문서를 함께 업데이트한다.

## 언어 사용

- 식별자(변수, 함수, 타입, 파일명)는 **영어**로 작성한다.
- 사용자에게 노출되는 문자열(에러 메시지, UI 텍스트)은 **한국어**로 작성한다.
  ```ts
  throw new HttpError(`요청 실패: ${res.status} ${url}`, res.status);
  ```
- 주석은 한국어로, "무엇을 하는지"가 아니라 "왜 이렇게 했는지"가 코드만 봐서는 드러나지 않을 때만 추가한다. JSDoc 블록은 함수의 동작이 자명하지 않은 경우(예: 특정 사이트의 파싱 전략)에만 붙인다.

## 파일/디렉토리 구조

- `lib/*.ts`: 순수 로직/유틸(`danawa.ts`, `http.ts`, `cache.ts`, `types.ts`). 소문자 파일명.
- `lib/vendors/*.ts`: 벤더 어댑터. 벤더 하나당 파일 하나, 공통 타입은 `vendors/types.ts`, 등록은 `vendors/index.ts`.
- `components/*.tsx`: React 컴포넌트, **PascalCase** 파일명.
- `app/`: Next.js App Router 규칙을 그대로 따른다 (`page.tsx`, `route.ts`, `[id]` 동적 세그먼트).

## Import

- 다른 최상위 디렉토리를 참조할 때는 `@/` 별칭을 쓴다: `import { SearchResultItem } from "@/lib/types"`.
- `lib/` 내부에서 서로 참조할 때는 상대 경로를 쓴다: `../types`, `./types` (예: `lib/vendors/*.ts` → `../types`).
- named export를 기본으로 하고, `default export`는 React 페이지/컴포넌트와 Next.js route handler에만 사용한다.

## 타입

- 객체 형태는 `interface`, 유니온/리터럴은 `type`으로 정의한다 (`lib/types.ts` 참고).
- 키 집합이 고정된 매핑은 `Record<K, V>`로 표현한다 (`VENDOR_LABELS`, `VendorUrls` 등).
- `tsconfig.json`의 `strict: true`를 유지하고 `any`는 사용하지 않는다. 불가피하면 `unknown` + 타입 좁히기를 사용한다.

## 비동기 처리 & 에러 핸들링

- `async/await`만 사용하고 `.then()` 체이닝은 쓰지 않는다.
- 에러 메시지 추출은 아래 패턴으로 통일한다:
  ```ts
  error instanceof Error ? error.message : "알 수 없는 오류";
  ```
- **벤더 어댑터(`VendorAdapter`)는 절대 throw하지 않는다.** 항상 `VendorPriceResult`로 정규화해서 반환하고, 실패 시 `status: "failed"` + `error` 메시지를 채운다. 각 어댑터 파일 안에 `failedResult()` 같은 로컬 헬퍼를 둔다.
- 서로 독립적인 비동기 작업(여러 벤더 조회 등)은 `Promise.allSettled`로 묶어 하나가 실패해도 나머지가 막히지 않게 한다 (`lib/vendors/index.ts#fetchAllVendorPrices` 참고).

## API 라우트 (`app/api/**/route.ts`)

- 핸들러 로직은 `try/catch`로 감싼다.
- 실패 응답: `NextResponse.json({ error: "한국어 메시지" }, { status })`.
- 성공 응답: 별도 wrapping 없이 데이터를 그대로 반환한다.
- 입력 검증(`params.id` 파싱 등)은 캐시/네트워크 호출 이전, 함수 최상단에서 먼저 처리한다.

## 캐싱 (`lib/cache.ts`)

- 프로세스 로컬 `TTLCache<T>`를 쓰고, dev 모드 HMR 생존을 위해 `globalThis`에 인스턴스를 보관한다.
- 사용 패턴은 항상 "캐시 조회 → 없으면 fetch → 캐시에 저장"이다:
  ```ts
  const cached = cache.get(key);
  if (cached) return cached;
  const result = await fetchSomething();
  cache.set(key, result);
  ```
- 벤더 가격 캐시처럼 실패 결과를 캐싱하면 안 되는 경우, `status === "success"`일 때만 `set`한다.

## 컴포넌트

- `export default function ComponentName() { ... }` 형태의 함수 선언을 쓴다(화살표 함수 컴포넌트 지양).
- 클라이언트 훅(`useState`, `useQuery` 등)이 필요한 파일에만 최상단에 `"use client"`를 명시한다.
- 스타일은 Tailwind 유틸리티 클래스를 인라인으로 작성하고, 색상 관련 클래스는 항상 `dark:` variant를 함께 고려한다.

## 포맷팅

- 세미콜론 사용, 큰따옴표(`"`) 사용, 2-space 들여쓰기.
- 별도 Prettier 설정은 없다 — `npm run lint`(`next/core-web-vitals` + `next/typescript`)가 유일한 정적 검사 도구이므로, 커밋 전에 반드시 실행한다.

## 새 벤더/기능 추가 시

새 벤더를 엔드투엔드로 추가하는 절차는 `CLAUDE.md`의 "새 벤더 엔드투엔드로 추가하기" 섹션을 따른다. 이 문서의 컨벤션(정규화된 반환 타입, 에러 처리 패턴, 캐싱 패턴)을 그대로 적용한다.
