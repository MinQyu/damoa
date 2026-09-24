import { ConditionalDiscount } from "../types";

const CARD_NAME_PATTERN = /([가-힣]{2,6}카드)(?=[Xx×]|\s|$)/;

/**
 * G마켓/옥션의 결제수단 즉시할인 문구(예: "삼성카드X스마일페이 / 최대 10% 결제 시 할인")에서
 * 카드사명만 뽑아낸다. 카드사 없이 페이 수단만으로 할인되는 경우도 있어 없으면 null을 반환한다.
 */
export function extractCardName(discountText: string): string | null {
  const match = discountText.match(CARD_NAME_PATTERN);
  return match ? match[1] : null;
}

/**
 * 결제수단 즉시할인가가 공통 실구매가(배송비 제외)보다 낮을 때만 조건부 할인으로 인정한다.
 * 즉시할인 박스가 판매가와 같은 금액을 띄우거나 쿠폰가보다 비싼 경우가 있어서다.
 */
export function buildConditionalDiscount(
  discountText: string | null,
  discountPrice: number | null,
  commonPrice: number,
  shippingFee: number | null
): ConditionalDiscount | null {
  if (discountPrice === null || discountPrice >= commonPrice) return null;
  const cardName = extractCardName(discountText ?? "");
  return {
    type: cardName ? "card" : "payment",
    cardName,
    price: discountPrice + (shippingFee ?? 0),
  };
}
