---
name: add-vendor
description: 다모아(Damoa)에 새 오픈마켓 벤더(쿠팡/G마켓/옥션/11번가처럼)를 엔드투엔드로 추가할 때 사용한다. VendorKey 등록부터 다나와 alt 매핑, 어댑터 구현, index 등록까지의 절차를 안내한다.
---

# 새 벤더 엔드투엔드로 추가하기

다모아에 오픈마켓 벤더를 하나 추가하려면 아래 순서대로 진행한다.

1. `lib/types.ts`의 `VendorKey`와 `VENDOR_LABELS`에 벤더를 추가한다.
2. `lib/danawa.ts`의 `VENDOR_ALT_MAP`(다나와 상세 페이지에서 해당 벤더 블록을 식별하는 데 사용)에 다나와 `alt` 텍스트 매핑을 추가하고, `fetchVendorUrls`에 URL 구성 분기를 추가한다.
3. `VendorAdapter`를 구현하는 `lib/vendors/<vendor>.ts`를 작성하여 공통 `VendorPriceResult` 형태(`lib/types.ts`)를 반환하게 한다.
4. `lib/vendors/index.ts`의 `VENDOR_ADAPTERS`(및 라벨 map)에 어댑터를 등록한다.

## 어댑터 작성 시 지켜야 할 컨벤션

`CONVENTIONS.md`의 규칙을 그대로 따른다. 특히:

- **절대 throw하지 않는다.** 실패 시에도 `VendorPriceResult`로 정규화해서 반환하고 `status: "failed"` + `error` 메시지를 채운다. 어댑터 파일 안에 `failedResult()` 같은 로컬 헬퍼를 둔다.
- `status`는 `success | failed | unavailable` 중 하나다. `unavailable`은 애초에 벤더 URL이 존재하지 않았음을, `failed`는 fetch/parse 시도 자체가 깨졌음을 의미한다.
- 사이트마다 가격 데이터 구조가 다를 수 있다(예: 11번가는 `og:description` 메타 + 취소선 엘리먼트로 `originalPrice`/`couponDiscount`를 분리 노출하지만, 다른 사이트는 단일 가격만 노출할 수 있음) — 무엇을 노출하든 공통 `VendorPriceResult` 형태로 정규화한다.
- fetch는 `lib/http.ts`의 `fetchHtml`/`parseWonAmount`에 의존한다.

## 봇 탐지가 있는 벤더라면

새 벤더가 일반 `fetch`나 headless 브라우저를 봇으로 차단한다면(쿠팡/G마켓/옥션이 이 경우다), `vendor-bot-bypass` 스킬을 참고해 `lib/browserSession.ts`의 CDP 연결 방식을 재사용한다.
