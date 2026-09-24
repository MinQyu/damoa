import { Page } from "puppeteer";
import { parseShippingFee } from "../http";

/**
 * G마켓/옥션(이베이코리아 공통 마크업)의 상품 상단 정보(.item-topinfo_sub) 중 배송 항목들.
 * 배송비 위치가 상품마다 다르다: 일반 배송은 delivery-predict 항목 안 두 번째 블록, 스타배송은
 * .box__delivery-information 안, 일부 옥션 상품은 .delivery_item 버튼("배송비 3,000원 열기").
 * 셋 다 .item-topinfo_sub의 직계 delivery 항목이라 한 번에 읽는다. 페이지 아래 추천 상품
 * 캐러셀에도 .box__delivery-info가 반복돼 그쪽은 피한다(2026-09 확인).
 */
const DELIVERY_AREA_SELECTOR = '.item-topinfo_sub > [class*="delivery"]';

/**
 * 배송비 문구는 가격보다 늦게 렌더링돼, 문구가 나타날 때까지 기다린 뒤 배송 영역 전체
 * 텍스트에서 배송비를 뽑는다. 끝내 나타나지 않으면 판단할 수 없어 null을 반환한다.
 */
export async function fetchEbayKoreaShippingFee(page: Page): Promise<number | null> {
  await page
    .waitForFunction(
      (selector) =>
        Array.from(document.querySelectorAll(selector)).some((el) =>
          /무료배송|배송비[^\n]{0,12}\d/.test(el.textContent ?? "")
        ),
      { timeout: 5000 },
      DELIVERY_AREA_SELECTOR
    )
    .catch(() => null);

  const deliveryText = await page
    .$$eval(DELIVERY_AREA_SELECTOR, (els) => els.map((el) => el.textContent ?? "").join("\n"))
    .catch(() => "");
  return parseShippingFee(deliveryText);
}
