---
name: vendor-bot-bypass
description: 쿠팡/G마켓/옥션 스크래핑이 403이나 봇 탐지 인터스티셜로 실패할 때, 또는 lib/browserSession.ts의 Chrome CDP 연결 방식을 이해하거나 수정해야 할 때 사용한다.
---

# 쿠팡/G마켓/옥션 봇 탐지 우회 (`lib/browserSession.ts`)

일반 `fetch`와 puppeteer가 직접 `launch()`한 headless 브라우저 요청은 모두 봇 탐지에 걸려 403이 반환된다.

## 우회 방식

사용자 백그라운드에 실제(headless가 아닌) Chrome을 `--remote-debugging-port`로 띄워두고 `puppeteer.connect()`로 CDP 연결해 접근하면 통과된다(2026-08 검증). `getBrowser()`/`withVendorPage()`가 이 연결을 관리한다:

- 필요 시 Chrome을 자동으로 새로 띄운다.
- 화면 밖(`--window-position`)에 배치해 사용자 작업을 방해하지 않는다.
- Next.js 서버와 분리(detached)되어 서버 재시작 후에도 살아있는다(콜드 스타트로 인한 반복적인 봇 확인 페이지를 줄이기 위함).

`coupang.ts`/`gmarket.ts`/`auction.ts`는 이 세션 위에서 `page.$eval`로 실제 렌더링된 DOM에서 가격을 추출한다. G마켓은 첫 진입 시 "봇 확인 중" 인터스티셜이 뜰 수 있어 `waitForRealPage()`로 통과를 기다린 뒤 파싱한다. 쿠팡은 CDP 연결 Chrome으로도 상품 페이지에 바로 들어가면 가끔 403("요청하신 페이지의 사용권한이 없습니다", 제목 "쿠팡!")을 받는데, 홈(`https://www.coupang.com/`)을 한 번 거친 뒤 다시 들어가면 통과한다(2026-09 확인). `coupang.ts#gotoProductPage`가 403일 때만 이 재시도를 한다.

## 트러블슈팅

이 우회는 시점/IP/세션에 따라 다시 막힐 수 있으므로 상시 보장되는 것은 아니다. 벤더 스크래핑이 다시 깨진다면 다음을 함께 확인한다:

1. 셀렉터가 바뀌었는지 (사이트 마크업 변경)
2. 이 봇 탐지 우회 자체가 막혔는지 (CDP로 연결한 Chrome도 403/인터스티셜을 받는지)
