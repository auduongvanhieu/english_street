/**
 * Prices of everything that costs coins in the areas (the API charges these; the client only shows them).
 * The coin economy is small (quizzes and the farm pay a few coins), so prices stay low.
 */
export const HOTEL_NIGHT_PRICE = 5;
export const HOTEL_MAX_NIGHTS = 3;
/** Premium tickets bought with coins: a VIP recliner in Screen 1 (with free popcorn), a first-class train seat. */
export const PREMIUM_PRICES = { 'cinema-vip': 10, 'train-first': 8 } as const;
export type PremiumItem = keyof typeof PREMIUM_PRICES;
/** A suite (premium): a bigger room on the top floor, the minibar is included. */
export const SUITE_NIGHT_PRICE = 15;
export const MINIBAR: { id: string; en: string; icon: string; price: number }[] = [
  { id: 'water', en: 'a bottle of water', icon: '💧', price: 1 },
  { id: 'juice', en: 'orange juice', icon: '🧃', price: 2 },
  { id: 'cola', en: 'a can of cola', icon: '🥤', price: 2 },
  { id: 'chocolate', en: 'a bar of chocolate', icon: '🍫', price: 2 },
  { id: 'crisps', en: 'a bag of crisps', icon: '🥔', price: 2 },
  { id: 'nuts', en: 'a packet of nuts', icon: '🥜', price: 3 },
];
export const MINIBAR_MAX = 8;

export interface HotelStay {
  room: number;
  nights: number;
  since: number;
  minibar: string[];
  /** price per night actually paid (0 for the free first stay) */
  nightPrice?: number;
  /** a suite: the minibar is included */
  suite?: boolean;
}
export interface HotelBillLine {
  en: string;
  qty: number;
  price: number;
}
export interface HotelBill {
  room: number;
  lines: HotelBillLine[];
  total: number;
}
