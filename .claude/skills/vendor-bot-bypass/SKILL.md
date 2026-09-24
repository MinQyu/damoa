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

`coupang.ts`/`gmarket.ts`/`auction.ts`는 이 세션 위에서 `page.$eval`로 실제 렌더링된 DOM에서 가격을 추출한다. G마켓은 첫 진입 시 "봇 확인 중" 인터스티셜이 뜰 수 있어 `waitForRealPage()`로 통과를 기다린 뒤 파싱한다.

## 쿠팡 403의 두 종류 (2026-09 분석)

쿠팡은 Akamai Bot Manager 뒤에 있고, 403이 서로 다른 두 층에서 온다. 응답 `server` 헤더로 구분한다(`coupang.ts#detectBlock`).

| | origin 차단 | akamai 차단 |
|---|---|---|
| 응답 | `server: envoy`, 제목 "쿠팡!"("요청하신 페이지의 사용권한이 없습니다") | `server: AkamaiGHost`, 제목 "Access Denied" |
| 언제 | 세션 없이 상품 페이지로 바로 들어갈 때 확률적으로 | 한 브라우저 세션이 봇으로 판정된 뒤 계속 |
| 홈(`https://www.coupang.com/`) 경유 재시도 | 효과 있음 → `gotoProductPage`가 이때만 재시도 | 효과 없음 |
| 복구 | 홈 한 번 방문 | 백그라운드 Chrome **프로세스 재시작** 후 홈 방문 |

분석에서 확인한 사실:

- IP 차단이 아니다. 같은 IP에서 새 프로필로 띄운 Chrome은 통과했다.
- Akamai 센서 스크립트(`/nsGyqwa7.../...` 경로로 POST)는 정상 전송되지만 판정 쿠키 `_abck`는 `~-1~`(미검증)에 머문다. 새 프로필도 `~-1~`인 채로 통과하므로 `_abck` 값 자체보다 세션 단위 누적 점수로 막는 것으로 보인다.
- akamai 차단 상태에서는 쿠팡 쿠키와 저장소를 지워도 곧 다시 막혔지만, 다모아 Chrome을 종료하고 같은 프로필로 다시 띄우자 통과했다.
- 세션이 찍히는 정확한 조건은 재현하지 못했다. 화면 밖 창에서 입력 없이 센서가 반복 실행되고, 요청마다 탭을 여닫고, 짧은 시간에 요청이 몰린 것이 누적된 것으로 추정한다.

그래서 쿠팡은 요청 수를 줄이도록 되어 있다: 전용 탭 하나를 재사용하며 요청을 한 번에 하나씩 처리하고(`browserSession.ts#withSharedVendorPage`), 가격 캐시를 20분으로 길게 잡고, 같은 URL의 동시 조회는 하나로 합친다(`vendors/index.ts#fetchVendorPriceCached`). 차단되면 서버 로그에 `[coupang] 403 차단(origin|akamai)`이 남는다.

진단할 때는 이 분석 자체가 쿠팡에 요청을 몰아 차단을 부추길 수 있으니 요청 수를 최소로 한다. 새 프로필 비교 실험은 `--user-data-dir`을 임시 폴더로 바꾼 Chrome을 다른 디버그 포트로 띄워서 한다.

## 트러블슈팅

이 우회는 시점/IP/세션에 따라 다시 막힐 수 있으므로 상시 보장되는 것은 아니다. 벤더 스크래핑이 다시 깨진다면 다음을 함께 확인한다:

1. 셀렉터가 바뀌었는지 (사이트 마크업 변경)
2. 이 봇 탐지 우회 자체가 막혔는지 (CDP로 연결한 Chrome도 403/인터스티셜을 받는지)
