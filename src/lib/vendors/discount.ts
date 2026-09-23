import { DiscountType } from "../types";

const CARD_NAME_PATTERN = /([가-힣]{2,6}카드)(?=[Xx×]|\s|$)/;

/**
 * G마켓/옥션의 결제수단 즉시할인 문구(예: "삼성카드X스마일페이 / 최대 10% 결제 시 할인")에서
 * 카드사명만 뽑아낸다. 카드사 없이 페이 수단만으로 할인되는 경우도 있어 없으면 null을 반환한다.
 */
export function extractCardName(discountText: string): string | null {
  const match = discountText.match(CARD_NAME_PATTERN);
  return match ? match[1] : null;
}

export function resolveInstantDiscountType(cardName: string | null): DiscountType {
  return cardName ? "card" : "payment";
}
